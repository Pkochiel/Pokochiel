import { describe, expect, it } from 'vitest';
import { enqueue, mergeRemote, removeOp, backoffMs } from './logic';
import type { RoomState, Spot, SyncOp } from '../types';
import { emptyRoomState } from '../lib/validation';

const spot = (id: string, over: Partial<Spot> = {}): Spot => ({
  id,
  name: `spot-${id}`,
  category: 'onsen',
  lat: 35,
  lng: 139,
  address: '',
  comment: '',
  createdBy: 'a',
  createdById: 'user-aaaa',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('enqueue', () => {
  it('upsert は同じスポットへの既存操作の位置を保って置き換える', () => {
    let q: SyncOp[] = [];
    q = enqueue(q, { kind: 'upsertSpot', spotId: 'a' });
    q = enqueue(q, { kind: 'stamp', spotId: 'a', at: 5 });
    q = enqueue(q, { kind: 'upsertSpot', spotId: 'a' });
    expect(q.map((o) => o.kind)).toEqual(['upsertSpot', 'stamp']);
  });
  it('removePhoto フラグは畳み込み後も保持される', () => {
    let q: SyncOp[] = [{ kind: 'upsertSpot', spotId: 'a', removePhoto: true }];
    q = enqueue(q, { kind: 'upsertSpot', spotId: 'a' });
    expect(q).toEqual([{ kind: 'upsertSpot', spotId: 'a', removePhoto: true }]);
  });
  it('stamp → unstamp は最新の1件だけ残る', () => {
    let q: SyncOp[] = [];
    q = enqueue(q, { kind: 'stamp', spotId: 'a', at: 1 });
    q = enqueue(q, { kind: 'unstamp', spotId: 'a' });
    q = enqueue(q, { kind: 'stamp', spotId: 'a', at: 2 });
    expect(q).toEqual([{ kind: 'stamp', spotId: 'a', at: 2 }]);
  });
  it('delete はそのスポットの未送信操作をすべて置き換える', () => {
    let q: SyncOp[] = [{ kind: 'upsertSpot', spotId: 'a' }, { kind: 'stamp', spotId: 'a', at: 1 }, { kind: 'upsertSpot', spotId: 'b' }];
    q = enqueue(q, { kind: 'deleteSpot', spotId: 'a' });
    expect(q).toEqual([{ kind: 'upsertSpot', spotId: 'b' }, { kind: 'deleteSpot', spotId: 'a' }]);
  });
});

describe('removeOp', () => {
  it('同一オブジェクトのみ削除し、置き換え済みの操作は残す', () => {
    const op: SyncOp = { kind: 'upsertSpot', spotId: 'a' };
    const replaced = enqueue([op], { kind: 'upsertSpot', spotId: 'a' });
    expect(removeOp(replaced, op)).toHaveLength(1);
    expect(removeOp([op], op)).toHaveLength(0);
  });
});

describe('mergeRemote', () => {
  const me = 'user-me-1';
  const base = (over: Partial<RoomState> = {}): RoomState => ({ ...emptyRoomState(), ...over });

  it('サーバーのスポットを取り込み、未送信のローカル編集は優先する', () => {
    const local = base({
      spots: { a: spot('a', { name: 'local-edit', updatedAt: 9 }), c: spot('c') },
      queue: [{ kind: 'upsertSpot', spotId: 'a' }],
    });
    const merged = mergeRemote(local, { spots: [spot('a', { name: 'server' }), spot('b')], visits: {}, deleted: {} }, me, 'me', 100);
    expect(merged.spots.a!.name).toBe('local-edit');
    expect(merged.spots.b).toBeDefined();
    // c はサーバーにも無く未送信でもない → 他の人に削除された
    expect(merged.spots.c).toBeUndefined();
    expect(merged.lastSyncedAt).toBe(100);
  });

  it('未送信の新規スポットは残るが、サーバーで削除済みなら消える', () => {
    const local = base({
      spots: { n: spot('n'), d: spot('d') },
      queue: [{ kind: 'upsertSpot', spotId: 'n' }, { kind: 'upsertSpot', spotId: 'd' }],
    });
    const merged = mergeRemote(local, { spots: [], visits: {}, deleted: { d: 1 } }, me, 'me', 1);
    expect(Object.keys(merged.spots)).toEqual(['n']);
  });

  it('未送信の削除はサーバーにあっても表示しない', () => {
    const local = base({ queue: [{ kind: 'deleteSpot', spotId: 'a' }] });
    const merged = mergeRemote(local, { spots: [spot('a')], visits: {}, deleted: {} }, me, 'me', 1);
    expect(merged.spots.a).toBeUndefined();
  });

  it('自分のスタンプはサーバー状態に関わらず保持される', () => {
    const local = base({ stamps: { gone: { spotId: 'gone', at: 1, name: 'x', category: 'onsen', onSite: false, tilt: 0 } } });
    const merged = mergeRemote(local, { spots: [], visits: {}, deleted: { gone: 2 } }, me, 'me', 1);
    expect(merged.stamps.gone).toBeDefined();
  });

  it('サーバーの訪問記録からスタンプを復元する（未送信の取り消しがある場合は除く）', () => {
    const remote = { spots: [spot('a'), spot('b')], visits: { a: { [me]: { nickname: 'me', at: 7 } }, b: { [me]: { nickname: 'me', at: 8 } } }, deleted: {} };
    const merged = mergeRemote(base({ queue: [{ kind: 'unstamp', spotId: 'b' }] }), remote, me, 'me', 1);
    expect(merged.stamps.a?.at).toBe(7);
    expect(merged.stamps.b).toBeUndefined();
    expect(merged.visits.b).toBeUndefined();
  });

  it('未送信のスタンプを訪問者リストに反映する', () => {
    const local = base({ queue: [{ kind: 'stamp', spotId: 'a', at: 3 }] });
    const merged = mergeRemote(local, { spots: [spot('a')], visits: { a: { other: { nickname: 'o', at: 1 } } }, deleted: {} }, me, 'me', 1);
    expect(Object.keys(merged.visits.a!).sort()).toEqual(['other', me].sort());
  });
});

describe('backoffMs', () => {
  it('指数的に増え、上限は60秒', () => {
    expect(backoffMs(0)).toBe(3000);
    expect(backoffMs(1)).toBe(6000);
    expect(backoffMs(20)).toBe(60000);
  });
});
