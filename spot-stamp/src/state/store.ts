// アプリ全体の状態管理。
// - ローカルファースト: すべての操作はまず端末に保存し、送信キュー経由でサーバーへ同期
// - スタンプ押印など重要な操作は「保存できなかったら取り消してエラー表示」で確実性を担保
import { useSyncExternalStore } from 'react';
import type { Profile, RoomState, Spot, Stamp, SyncOp, SyncStatus } from '../types';
import { api, ApiError, NetworkError } from '../lib/api';
import { readJson, writeJson, StorageError } from '../lib/storage';
import { parseRoomState, ROOM_RE, LIMITS, isValidLatLng } from '../lib/validation';
import { newId } from '../lib/ids';
import { photoStore } from '../lib/photoStore';
import { blobToDataUrl } from '../lib/image';
import { distanceM, geoPermissionGranted, getCurrentPosition } from '../lib/geo';
import { enqueue, mergeRemote, removeOp, backoffMs } from './logic';
import type { Category } from '../types';

const KEY = {
  profile: 'spostamp:v1:profile',
  settings: 'spostamp:v1:settings',
  currentRoom: 'spostamp:v1:currentRoom',
  room: (id: string) => `spostamp:v1:room:${id}`,
};

export const DEFAULT_ROOM = 'public-lobby';
export const ON_SITE_RADIUS_M = 500;

export interface Toast {
  id: string;
  kind: 'info' | 'success' | 'error';
  message: string;
}

export interface Settings {
  muted: boolean;
}

export interface AppState {
  profile: Profile | null;
  roomId: string;
  room: RoomState;
  syncStatus: SyncStatus;
  /** サーバーが無い（静的ホスティング等）場合は端末内のみで動作 */
  serverAvailable: boolean | null;
  settings: Settings;
  toasts: Toast[];
}

export interface SpotInput {
  name: string;
  category: Category;
  lat: number;
  lng: number;
  address: string;
  comment: string;
  /** undefined: 変更なし / null: 写真を削除 / Blob: 新しい写真 */
  photo?: Blob | null;
}

function loadProfile(): Profile | null {
  const raw = readJson(KEY.profile) as Partial<Profile> | null;
  if (raw && typeof raw.userId === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(raw.userId) && typeof raw.nickname === 'string' && raw.nickname.trim()) {
    return { userId: raw.userId, nickname: raw.nickname.slice(0, LIMITS.nickname) };
  }
  return null;
}

function loadSettings(): Settings {
  const raw = readJson(KEY.settings) as Partial<Settings> | null;
  return { muted: raw?.muted === true };
}

function initialRoomId(): string {
  try {
    const fromUrl = new URLSearchParams(location.search).get('room')?.toLowerCase();
    if (fromUrl && ROOM_RE.test(fromUrl)) return fromUrl;
  } catch {
    /* ignore */
  }
  const saved = readJson(KEY.currentRoom);
  return typeof saved === 'string' && ROOM_RE.test(saved) ? saved : DEFAULT_ROOM;
}

export class AppStore {
  private state: AppState;
  private listeners = new Set<() => void>();
  private flushing: Promise<void> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private storageWarned = false;

  constructor() {
    const roomId = initialRoomId();
    this.state = {
      profile: loadProfile(),
      roomId,
      room: parseRoomState(readJson(KEY.room(roomId))),
      syncStatus: 'idle',
      serverAvailable: null,
      settings: loadSettings(),
      toasts: [],
    };
  }

  // ---- 購読 ----
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;

  private set(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /**
   * ルーム状態を更新して端末に保存する。
   * critical=true の場合、保存に失敗したら変更を取り消して例外を投げる。
   */
  private commitRoom(next: RoomState, critical = false) {
    const roomId = this.state.roomId;
    try {
      writeJson(KEY.room(roomId), next);
    } catch (err) {
      if (critical) throw err;
      if (!this.storageWarned) {
        this.storageWarned = true;
        this.toast('error', err instanceof StorageError ? `${err.message}。データが失われる可能性があります` : '端末への保存に失敗しました');
      }
    }
    this.set({ room: next });
  }

  // ---- トースト ----
  toast(kind: Toast['kind'], message: string, ms = 3200) {
    const t: Toast = { id: newId(8), kind, message };
    this.set({ toasts: [...this.state.toasts.slice(-2), t] });
    setTimeout(() => this.dismissToast(t.id), ms);
  }
  dismissToast(id: string) {
    if (this.state.toasts.some((t) => t.id === id)) this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  }

  // ---- プロフィール・設定 ----
  setProfile(nickname: string) {
    const name = nickname.trim().slice(0, LIMITS.nickname);
    if (!name) throw new Error('ニックネームを入力してください');
    const profile: Profile = { userId: this.state.profile?.userId ?? newId(20), nickname: name };
    try {
      writeJson(KEY.profile, profile);
    } catch (err) {
      this.toast('error', err instanceof Error ? err.message : '保存に失敗しました');
    }
    this.set({ profile });
  }

  setMuted(muted: boolean) {
    const settings = { ...this.state.settings, muted };
    try {
      writeJson(KEY.settings, settings);
    } catch {
      /* 設定は致命的ではない */
    }
    this.set({ settings });
  }

  // ---- グループ（ルーム） ----
  switchRoom(roomId: string) {
    const id = roomId.trim().toLowerCase();
    if (!ROOM_RE.test(id)) throw new Error('グループコードは英小文字・数字・ハイフンで3〜32文字です');
    if (id === this.state.roomId) return;
    try {
      writeJson(KEY.currentRoom, id);
    } catch {
      /* ignore */
    }
    this.retryAttempt = 0;
    this.set({ roomId: id, room: parseRoomState(readJson(KEY.room(id))), syncStatus: 'idle' });
    try {
      const url = new URL(location.href);
      url.searchParams.set('room', id);
      history.replaceState(null, '', url);
    } catch {
      /* ignore */
    }
    void this.sync();
  }

  /** 他のタブで更新されたら読み直す */
  reloadFromStorage(key: string | null) {
    if (key === KEY.room(this.state.roomId) || key === null) {
      this.set({ room: parseRoomState(readJson(KEY.room(this.state.roomId))) });
    }
  }

  // ---- スポット ----
  private requireProfile(): Profile {
    const p = this.state.profile;
    if (!p) throw new Error('先にニックネームを登録してください');
    return p;
  }

  async saveSpot(input: SpotInput, existingId?: string): Promise<Spot> {
    const profile = this.requireProfile();
    const name = input.name.trim();
    if (!name) throw new Error('スポット名を入力してください');
    if (!isValidLatLng(input.lat, input.lng)) throw new Error('場所が正しくありません');
    const prev = existingId ? this.state.room.spots[existingId] : undefined;
    if (existingId && !prev) throw new Error('スポットが見つかりません（削除された可能性があります）');
    if (prev && prev.createdById !== profile.userId) throw new Error('自分が登録したスポットのみ編集できます');

    const id = existingId ?? newId(16);
    const now = Date.now();
    // 写真は先に IndexedDB に保存（失敗したら登録自体を中断してユーザーに知らせる）
    if (input.photo) {
      try {
        await photoStore.put(id, input.photo);
      } catch {
        throw new Error('写真を端末に保存できませんでした。写真なしで登録するか、容量を確保してください');
      }
    }
    const spot: Spot = {
      id,
      name: name.slice(0, LIMITS.name),
      category: input.category,
      lat: input.lat,
      lng: input.lng,
      address: input.address.trim().slice(0, LIMITS.address),
      comment: input.comment.trim().slice(0, LIMITS.comment),
      createdBy: profile.nickname,
      createdById: profile.userId,
      createdAt: prev?.createdAt ?? now,
      updatedAt: Math.max(now, (prev?.updatedAt ?? 0) + 1),
    };
    if (input.photo) spot.localPhoto = true;
    else if (input.photo === undefined && prev) {
      if (prev.photoUrl) spot.photoUrl = prev.photoUrl;
      if (prev.localPhoto) spot.localPhoto = true;
    }
    const removePhoto = input.photo === null || (input.photo instanceof Blob && !!prev?.photoUrl);
    if (input.photo === null) void photoStore.delete(id).catch(() => {});

    const room = this.state.room;
    // スタンプのスナップショット名も追従させる
    const stamps = { ...room.stamps };
    const st = stamps[id];
    if (st) stamps[id] = { ...st, name: spot.name, category: spot.category };
    const op: SyncOp = removePhoto ? { kind: 'upsertSpot', spotId: id, removePhoto: true } : { kind: 'upsertSpot', spotId: id };
    this.commitRoom({ ...room, spots: { ...room.spots, [id]: spot }, stamps, queue: enqueue(room.queue, op) }, true);
    void this.flush();
    return spot;
  }

  deleteSpot(id: string) {
    const profile = this.requireProfile();
    const room = this.state.room;
    const spot = room.spots[id];
    if (!spot) return;
    if (spot.createdById !== profile.userId) throw new Error('自分が登録したスポットのみ削除できます');
    const { [id]: _removed, ...spots } = room.spots;
    // 自分のスタンプはスタンプ帳に思い出として残す
    this.commitRoom({ ...room, spots, queue: enqueue(room.queue, { kind: 'deleteSpot', spotId: id }) }, true);
    void photoStore.delete(id).catch(() => {});
    void this.flush();
  }

  // ---- スタンプ ----
  /** 現地にいるかを判定（位置情報が既に許可されている場合のみ。許可ダイアログは出さない） */
  private async checkOnSite(spot: Spot): Promise<boolean> {
    try {
      if (!(await geoPermissionGranted())) return false;
      const pos = await getCurrentPosition({ timeout: 4000, highAccuracy: true });
      return distanceM(pos, spot) <= ON_SITE_RADIUS_M;
    } catch {
      return false;
    }
  }

  /**
   * スタンプを押す。端末に保存できた場合のみ成功として Stamp を返す。
   * すでに押している場合は既存のスタンプを返す（二重押し防止）。
   */
  async stamp(spotId: string): Promise<{ stamp: Stamp; isNew: boolean }> {
    const profile = this.requireProfile();
    const existing = this.state.room.stamps[spotId];
    if (existing) return { stamp: existing, isNew: false };
    const spot = this.state.room.spots[spotId];
    if (!spot) throw new Error('スポットが見つかりません');
    const onSite = await this.checkOnSite(spot);
    // await 中に別操作で押されていたら二重にしない
    const room = this.state.room;
    if (room.stamps[spotId]) return { stamp: room.stamps[spotId]!, isNew: false };
    const at = Date.now();
    const stamp: Stamp = {
      spotId,
      at,
      name: spot.name,
      category: spot.category,
      onSite,
      tilt: Math.round((Math.random() * 16 - 8) * 10) / 10,
    };
    const visits = { ...room.visits, [spotId]: { ...(room.visits[spotId] ?? {}), [profile.userId]: { nickname: profile.nickname, at } } };
    try {
      this.commitRoom(
        { ...room, stamps: { ...room.stamps, [spotId]: stamp }, visits, queue: enqueue(room.queue, { kind: 'stamp', spotId, at }) },
        true,
      );
    } catch (err) {
      throw new Error(err instanceof StorageError ? `スタンプを保存できませんでした：${err.message}` : 'スタンプを保存できませんでした');
    }
    void this.flush();
    return { stamp, isNew: true };
  }

  unstamp(spotId: string) {
    const profile = this.requireProfile();
    const room = this.state.room;
    if (!room.stamps[spotId]) return;
    const { [spotId]: _s, ...stamps } = room.stamps;
    const visits = { ...room.visits };
    if (visits[spotId]) {
      const { [profile.userId]: _me, ...rest } = visits[spotId]!;
      if (Object.keys(rest).length) visits[spotId] = rest;
      else delete visits[spotId];
    }
    this.commitRoom({ ...room, stamps, visits, queue: enqueue(room.queue, { kind: 'unstamp', spotId }) }, true);
    void this.flush();
  }

  // ---- 同期 ----
  /** キュー送信 → サーバー状態の取得・マージ */
  async sync(): Promise<void> {
    await this.flush();
    const roomId = this.state.roomId;
    const profile = this.state.profile;
    if (!profile) return;
    try {
      if (this.state.syncStatus !== 'syncing') this.set({ syncStatus: 'syncing' });
      const remote = await api.getState(roomId);
      if (roomId !== this.state.roomId) return; // 取得中にグループが切り替わった
      this.commitRoom(mergeRemote(this.state.room, remote, profile.userId, profile.nickname, Date.now()));
      this.set({ syncStatus: this.state.room.queue.length ? 'offline' : 'idle', serverAvailable: true });
    } catch (err) {
      this.handleSyncError(err);
    }
  }

  private handleSyncError(err: unknown) {
    if (err instanceof NetworkError) {
      this.set({ syncStatus: 'offline', serverAvailable: this.state.serverAvailable === true ? true : false });
    } else {
      console.error('[sync]', err);
      this.set({ syncStatus: 'error' });
    }
    this.scheduleRetry();
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    const delay = backoffMs(this.retryAttempt++);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.sync();
    }, delay);
  }

  /** ネット復帰時などに即時再送 */
  retryNow() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.retryAttempt = 0;
    void this.sync();
  }

  flush(): Promise<void> {
    // 同時に複数のフラッシュが走らないようにする
    if (!this.flushing) {
      this.flushing = this.doFlush().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async doFlush() {
    const profile = this.state.profile;
    if (!profile) return;
    const roomId = this.state.roomId;
    while (this.state.roomId === roomId && this.state.room.queue.length > 0) {
      const op = this.state.room.queue[0]!;
      this.set({ syncStatus: 'syncing' });
      try {
        await this.sendOp(roomId, op, profile);
        this.retryAttempt = 0;
        if (this.state.roomId !== roomId) return;
        this.commitRoom({ ...this.state.room, queue: removeOp(this.state.room.queue, op) });
        this.set({ serverAvailable: true });
      } catch (err) {
        if (this.state.roomId !== roomId) return;
        if (err instanceof ApiError && err.permanent) {
          // 再送しても成功しない操作は破棄して知らせる
          this.commitRoom({ ...this.state.room, queue: removeOp(this.state.room.queue, op) });
          this.handlePermanentFailure(op, err);
          continue;
        }
        this.handleSyncError(err);
        return;
      }
    }
    if (this.state.syncStatus === 'syncing') this.set({ syncStatus: 'idle' });
  }

  private async sendOp(roomId: string, op: SyncOp, profile: Profile) {
    switch (op.kind) {
      case 'upsertSpot': {
        const spot = this.state.room.spots[op.spotId];
        if (!spot) return; // ローカルで削除済み → 送る必要なし
        let photoData: string | null = null;
        if (spot.localPhoto) {
          const blob = await photoStore.get(spot.id).catch(() => undefined);
          if (blob) photoData = await blobToDataUrl(blob);
        }
        const saved = await api.putSpot(roomId, spot, photoData, op.removePhoto === true);
        const current = this.state.room.spots[op.spotId];
        // 送信中に編集されていなければサーバーの結果（写真URL等）を反映
        if (current && current.updatedAt === spot.updatedAt && this.state.roomId === roomId) {
          this.commitRoom({ ...this.state.room, spots: { ...this.state.room.spots, [saved.id]: saved } });
          if (spot.localPhoto) void photoStore.delete(spot.id).catch(() => {});
        }
        return;
      }
      case 'deleteSpot':
        await api.deleteSpot(roomId, op.spotId, profile.userId);
        return;
      case 'stamp':
        await api.putVisit(roomId, op.spotId, profile.userId, profile.nickname, op.at);
        return;
      case 'unstamp':
        await api.deleteVisit(roomId, op.spotId, profile.userId);
        return;
    }
  }

  private handlePermanentFailure(op: SyncOp, err: ApiError) {
    console.warn('[sync] dropped op', op, err);
    const room = this.state.room;
    if (op.kind === 'upsertSpot') {
      if (err.status === 410) {
        const { [op.spotId]: _gone, ...spots } = room.spots;
        this.commitRoom({ ...room, spots });
        this.toast('error', 'このスポットは他のメンバーによって削除されていました');
      } else {
        this.toast('error', `スポットを共有できませんでした（${err.message}）`);
      }
    } else if (op.kind === 'stamp' && err.status === 404) {
      // スポットが消えていてもスタンプ帳には残す
      this.toast('info', 'スポットが削除済みのため、スタンプは自分のスタンプ帳にのみ記録されました');
    } else if (op.kind === 'deleteSpot') {
      this.toast('error', `削除を共有できませんでした（${err.message}）`);
    }
  }
}

export const store = new AppStore();

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

