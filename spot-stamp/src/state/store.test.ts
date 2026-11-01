import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new DOMException('full', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

let storage: MemoryStorage;
let fetchMock: ReturnType<typeof vi.fn>;

function json(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

async function freshStore() {
  vi.resetModules();
  const mod = await import('./store');
  return mod.store;
}

const input = { name: '道後温泉', category: 'onsen' as const, lat: 33.85, lng: 132.79, address: '', comment: '最高' };

beforeEach(() => {
  storage = new MemoryStorage();
  fetchMock = vi.fn(() => Promise.reject(new TypeError('offline')));
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('location', new URL('http://localhost/'));
  vi.stubGlobal('history', { replaceState: () => {} });
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

describe('AppStore', () => {
  it('オフラインでもスポット登録とスタンプが端末に保存され、再起動後も残る', async () => {
    const s1 = await freshStore();
    s1.setProfile('たろう');
    const spot = await s1.saveSpot(input);
    const { stamp, isNew } = await s1.stamp(spot.id);
    expect(isNew).toBe(true);
    expect(stamp.name).toBe('道後温泉');
    await s1.flush();
    expect(s1.getState().room.queue.map((o) => o.kind)).toEqual(['upsertSpot', 'stamp']);

    // 再起動（モジュールを読み直す）
    const s2 = await freshStore();
    expect(s2.getState().profile?.nickname).toBe('たろう');
    expect(s2.getState().room.stamps[spot.id]).toBeDefined();
    expect(s2.getState().room.spots[spot.id]?.name).toBe('道後温泉');
    expect(s2.getState().room.queue).toHaveLength(2);
  });

  it('二重押しでもスタンプは1つ', async () => {
    const s = await freshStore();
    s.setProfile('a');
    const spot = await s.saveSpot(input);
    const [a, b] = await Promise.all([s.stamp(spot.id), s.stamp(spot.id)]);
    expect([a.isNew, b.isNew].filter(Boolean)).toHaveLength(1);
    expect(Object.keys(s.getState().room.stamps)).toHaveLength(1);
    expect(s.getState().room.queue.filter((o) => o.kind === 'stamp')).toHaveLength(1);
  });

  it('保存容量不足のときはスタンプを押した扱いにせずエラーを返す', async () => {
    const s = await freshStore();
    s.setProfile('a');
    const spot = await s.saveSpot(input);
    storage.failWrites = true;
    await expect(s.stamp(spot.id)).rejects.toThrow(/保存容量/);
    expect(s.getState().room.stamps[spot.id]).toBeUndefined();
    storage.failWrites = false;
    await expect(s.stamp(spot.id)).resolves.toMatchObject({ isNew: true });
  });

  it('オンラインになると送信キューが順番に送られ、サーバーの写真URLが反映される', async () => {
    const s = await freshStore();
    s.setProfile('a');
    const spot = await s.saveSpot(input);
    await s.stamp(spot.id);
    await s.flush();
    expect(s.getState().syncStatus).toBe('offline');

    const calls: string[] = [];
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      if (url.includes('/spots/')) {
        const body = JSON.parse(String(init.body));
        return json(200, { spot: { ...body.spot, id: spot.id, photoUrl: '/uploads/x.jpg' } });
      }
      if (url.endsWith('/state')) return json(200, { spots: [{ ...spot, photoUrl: '/uploads/x.jpg' }], visits: {}, deleted: {} });
      return json(200, { ok: true });
    });
    s.retryNow();
    await vi.waitFor(() => expect(s.getState().room.queue).toHaveLength(0));
    await vi.waitFor(() => expect(s.getState().syncStatus).toBe('idle'));
    expect(calls[0]).toMatch(/^PUT .*\/spots\//);
    expect(calls[1]).toMatch(/^PUT .*\/visits\//);
    expect(s.getState().room.spots[spot.id]?.photoUrl).toBe('/uploads/x.jpg');
    expect(s.getState().room.stamps[spot.id]).toBeDefined();
    expect(s.getState().serverAvailable).toBe(true);
  });

  it('サーバーが拒否した操作（4xx）はキューから外して通知し、後続は送られる', async () => {
    const s = await freshStore();
    s.setProfile('a');
    const spot = await s.saveSpot(input);
    await s.stamp(spot.id);
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/spots/')) return json(410, { error: 'spot was deleted' });
      if (url.includes('/visits/')) return json(404, { error: 'spot not found' });
      return json(200, { spots: [], visits: {}, deleted: { [spot.id]: 1 } });
    });
    await s.sync();
    expect(s.getState().room.queue).toHaveLength(0);
    expect(s.getState().room.spots[spot.id]).toBeUndefined();
    // スタンプは思い出として残る
    expect(s.getState().room.stamps[spot.id]).toBeDefined();
    expect(s.getState().toasts.length).toBeGreaterThan(0);
  });

  it('他人のスポットは編集・削除できない', async () => {
    const s = await freshStore();
    s.setProfile('a');
    const spot = await s.saveSpot(input);
    // 別ユーザーとして振る舞う
    storage.data.set('spostamp:v1:profile', JSON.stringify({ userId: 'other-user-1', nickname: 'b' }));
    const s2 = await freshStore();
    await expect(s2.saveSpot(input, spot.id)).rejects.toThrow(/自分が登録/);
    expect(() => s2.deleteSpot(spot.id)).toThrow(/自分が登録/);
  });

  it('不正なグループコードは拒否する', async () => {
    const s = await freshStore();
    expect(() => s.switchRoom('../etc')).toThrow();
    s.switchRoom('abcd-efgh');
    expect(s.getState().roomId).toBe('abcd-efgh');
  });

  it('スタンプ取り消しは送信キューに入り、訪問者からも外れる', async () => {
    const s = await freshStore();
    s.setProfile('a');
    const spot = await s.saveSpot(input);
    await s.stamp(spot.id);
    s.unstamp(spot.id);
    expect(s.getState().room.stamps[spot.id]).toBeUndefined();
    expect(s.getState().room.visits[spot.id]).toBeUndefined();
    expect(s.getState().room.queue.map((o) => o.kind)).toEqual(['upsertSpot', 'unstamp']);
  });
});
