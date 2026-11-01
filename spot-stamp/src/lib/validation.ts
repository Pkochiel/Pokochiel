import type { Category, RoomState, Spot, Stamp, SyncOp, Visits } from '../types';
import { isCategory } from './categories';

export const LIMITS = { name: 60, comment: 500, address: 200, nickname: 24 } as const;
export const ROOM_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return num(lat) && num(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** 外部（localStorage / サーバー）から来たスポットを検証。壊れていれば null */
export function parseSpot(v: unknown): Spot | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== 'string' || !v.id) return null;
  if (typeof v.name !== 'string' || !v.name.trim()) return null;
  if (!isCategory(v.category)) return null;
  if (!isValidLatLng(v.lat, v.lng)) return null;
  const spot: Spot = {
    id: v.id,
    name: str(v.name, LIMITS.name),
    category: v.category,
    lat: v.lat as number,
    lng: v.lng as number,
    address: str(v.address, LIMITS.address),
    comment: str(v.comment, LIMITS.comment),
    createdBy: str(v.createdBy, LIMITS.nickname) || '名無し',
    createdById: str(v.createdById, 64),
    createdAt: num(v.createdAt) ? v.createdAt : 0,
    updatedAt: num(v.updatedAt) ? v.updatedAt : 0,
  };
  if (typeof v.photoUrl === 'string' && /^(\/uploads\/|https?:\/\/)/.test(v.photoUrl)) spot.photoUrl = v.photoUrl;
  if (v.localPhoto === true) spot.localPhoto = true;
  return spot;
}

export function parseStamp(v: unknown): Stamp | null {
  if (!isObj(v)) return null;
  if (typeof v.spotId !== 'string' || !num(v.at) || !isCategory(v.category)) return null;
  return {
    spotId: v.spotId,
    at: v.at,
    name: str(v.name, LIMITS.name) || '???',
    category: v.category as Category,
    onSite: v.onSite === true,
    tilt: num(v.tilt) ? Math.max(-15, Math.min(15, v.tilt)) : 0,
  };
}

function parseOp(v: unknown): SyncOp | null {
  if (!isObj(v) || typeof v.spotId !== 'string') return null;
  switch (v.kind) {
    case 'upsertSpot':
      return { kind: 'upsertSpot', spotId: v.spotId, ...(v.removePhoto === true ? { removePhoto: true } : {}) };
    case 'deleteSpot':
    case 'unstamp':
      return { kind: v.kind, spotId: v.spotId };
    case 'stamp':
      return num(v.at) ? { kind: 'stamp', spotId: v.spotId, at: v.at } : null;
    default:
      return null;
  }
}

export function parseVisits(v: unknown): Visits {
  const out: Visits = {};
  if (!isObj(v)) return out;
  for (const [spotId, users] of Object.entries(v)) {
    if (!isObj(users)) continue;
    const u: Visits[string] = {};
    for (const [userId, rec] of Object.entries(users)) {
      if (isObj(rec) && num(rec.at)) u[userId] = { nickname: str(rec.nickname, LIMITS.nickname) || '名無し', at: rec.at };
    }
    if (Object.keys(u).length) out[spotId] = u;
  }
  return out;
}

export function emptyRoomState(): RoomState {
  return { spots: {}, stamps: {}, visits: {}, queue: [], lastSyncedAt: null };
}

/** localStorage の内容を復元。部分的に壊れていても読める部分は救出する */
export function parseRoomState(raw: unknown): RoomState {
  const state = emptyRoomState();
  if (!isObj(raw)) return state;
  if (isObj(raw.spots)) {
    for (const s of Object.values(raw.spots)) {
      const spot = parseSpot(s);
      if (spot) state.spots[spot.id] = spot;
    }
  }
  if (isObj(raw.stamps)) {
    for (const s of Object.values(raw.stamps)) {
      const stamp = parseStamp(s);
      if (stamp) state.stamps[stamp.spotId] = stamp;
    }
  }
  state.visits = parseVisits(raw.visits);
  if (Array.isArray(raw.queue)) state.queue = raw.queue.map(parseOp).filter((o): o is SyncOp => o !== null);
  state.lastSyncedAt = num(raw.lastSyncedAt) ? raw.lastSyncedAt : null;
  return state;
}

export interface SpotDraft {
  name: string;
  category: Category | '';
  lat: number | null;
  lng: number | null;
  address: string;
  comment: string;
}

export type DraftErrors = Partial<Record<'name' | 'category' | 'location' | 'comment', string>>;

export function validateDraft(d: SpotDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.name.trim()) e.name = 'スポット名を入力してください';
  else if (d.name.trim().length > LIMITS.name) e.name = `スポット名は${LIMITS.name}文字以内にしてください`;
  if (!d.category) e.category = 'カテゴリを選んでください';
  if (!isValidLatLng(d.lat, d.lng)) e.location = '場所を地図で指定してください';
  if (d.comment.length > LIMITS.comment) e.comment = `コメントは${LIMITS.comment}文字以内にしてください`;
  return e;
}
