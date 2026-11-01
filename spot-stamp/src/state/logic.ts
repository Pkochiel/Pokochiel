// 状態遷移の純粋関数（ユニットテスト対象）
import type { RoomState, Spot, Stamp, SyncOp, Visits } from '../types';
import type { RemoteState } from '../lib/api';

const sameTarget = (a: SyncOp, b: SyncOp) => a.spotId === b.spotId;

/**
 * 送信キューに操作を追加する。同じ対象への冗長な操作は畳み込む。
 * - upsertSpot は既存の位置を保つ（後続の stamp より先に送られるように）
 * - deleteSpot はそのスポットへの未送信操作をすべて置き換える
 */
export function enqueue(queue: SyncOp[], op: SyncOp): SyncOp[] {
  switch (op.kind) {
    case 'upsertSpot': {
      const i = queue.findIndex((q) => q.kind === 'upsertSpot' && sameTarget(q, op));
      if (i >= 0) {
        const prev = queue[i] as Extract<SyncOp, { kind: 'upsertSpot' }>;
        const merged: SyncOp = { kind: 'upsertSpot', spotId: op.spotId };
        if (prev.removePhoto || op.removePhoto) merged.removePhoto = true;
        const next = queue.slice();
        next[i] = merged;
        return next;
      }
      return [...queue, op];
    }
    case 'deleteSpot':
      return [...queue.filter((q) => !sameTarget(q, op)), op];
    case 'stamp':
    case 'unstamp':
      return [...queue.filter((q) => !((q.kind === 'stamp' || q.kind === 'unstamp') && sameTarget(q, op))), op];
  }
}

/** 自分の未送信スタンプ操作を訪問者リストに反映する */
function overlayMyVisits(visits: Visits, queue: SyncOp[], userId: string, nickname: string): Visits {
  const out: Visits = {};
  for (const [k, v] of Object.entries(visits)) out[k] = { ...v };
  for (const op of queue) {
    if (op.kind === 'stamp') {
      out[op.spotId] = { ...(out[op.spotId] ?? {}), [userId]: { nickname, at: op.at } };
    } else if (op.kind === 'unstamp' && out[op.spotId]) {
      const { [userId]: _removed, ...rest } = out[op.spotId]!;
      if (Object.keys(rest).length) out[op.spotId] = rest;
      else delete out[op.spotId];
    }
  }
  return out;
}

/**
 * サーバーの状態とローカル状態をマージする。
 * 未送信の変更（キューにあるもの）はローカルを優先し、それ以外はサーバーを正とする。
 */
export function mergeRemote(local: RoomState, remote: RemoteState, userId: string, nickname: string, now: number): RoomState {
  const pendingUpsert = new Set(local.queue.filter((o) => o.kind === 'upsertSpot').map((o) => o.spotId));
  const pendingDelete = new Set(local.queue.filter((o) => o.kind === 'deleteSpot').map((o) => o.spotId));
  const pendingUnstamp = new Set(local.queue.filter((o) => o.kind === 'unstamp').map((o) => o.spotId));

  const spots: Record<string, Spot> = {};
  for (const rs of remote.spots) {
    if (pendingDelete.has(rs.id)) continue;
    const ls = local.spots[rs.id];
    if (pendingUpsert.has(rs.id) && ls) spots[rs.id] = ls;
    else spots[rs.id] = rs;
  }
  // サーバーにまだ無いローカルスポット: 未送信なら残す、そうでなければ他の人に削除された
  for (const ls of Object.values(local.spots)) {
    if (spots[ls.id] || pendingDelete.has(ls.id)) continue;
    if (pendingUpsert.has(ls.id) && !remote.deleted[ls.id]) spots[ls.id] = ls;
  }

  // サーバーの訪問記録に自分がいるのに手元のスタンプが無い → 復元（ストレージ消去からの回復）
  const stamps: Record<string, Stamp> = { ...local.stamps };
  for (const [spotId, users] of Object.entries(remote.visits)) {
    const mine = users[userId];
    const sp = spots[spotId];
    if (mine && sp && !stamps[spotId] && !pendingUnstamp.has(spotId)) {
      stamps[spotId] = { spotId, at: mine.at, name: sp.name, category: sp.category, onSite: false, tilt: 0 };
    }
  }

  return {
    spots,
    stamps,
    visits: overlayMyVisits(remote.visits, local.queue, userId, nickname),
    queue: local.queue,
    lastSyncedAt: now,
  };
}

export function removeOp(queue: SyncOp[], op: SyncOp): SyncOp[] {
  const i = queue.indexOf(op);
  if (i < 0) return queue;
  return [...queue.slice(0, i), ...queue.slice(i + 1)];
}

/** 再送間隔（指数バックオフ, 最大60秒） */
export function backoffMs(attempt: number): number {
  return Math.min(60_000, 3000 * 2 ** Math.max(0, attempt));
}
