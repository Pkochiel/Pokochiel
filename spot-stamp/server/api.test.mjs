import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from './index.mjs';
import { RoomStore } from './store.mjs';

let dir, server, base;
// 1x1 の JPEG
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

const spot = (over = {}) => ({ name: '草津温泉', category: 'onsen', lat: 36.62, lng: 138.6, comment: 'いい湯', createdBy: 'a', createdById: 'user-aaaa', updatedAt: 10, ...over });
const req = (method, p, body) =>
  fetch(base + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null), headers: r.headers }));

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'spostamp-'));
  ({ server } = await createApp({ dataDir: dir, staticDir: path.join(dir, 'nodist') }));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

describe('API', () => {
  it('スポットの登録・取得・写真配信', async () => {
    const put = await req('PUT', '/api/rooms/test-room/spots/spot-0001', { spot: spot(), photoData: JPEG });
    expect(put.status).toBe(200);
    expect(put.body.spot.photoUrl).toMatch(/^\/uploads\/test-room-spot-0001-[a-f0-9]{8}\.jpg$/);
    const st = await req('GET', '/api/rooms/test-room/state');
    expect(st.body.spots).toHaveLength(1);
    const img = await fetch(base + put.body.spot.photoUrl);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/jpeg');
  });

  it('同じIDで再送しても重複しない（冪等）、古い更新は無視', async () => {
    await req('PUT', '/api/rooms/test-room/spots/spot-0001', { spot: spot({ name: '新しい名前', updatedAt: 20 }) });
    await req('PUT', '/api/rooms/test-room/spots/spot-0001', { spot: spot({ name: '古い名前', updatedAt: 15 }) });
    const st = await req('GET', '/api/rooms/test-room/state');
    expect(st.body.spots).toHaveLength(1);
    expect(st.body.spots[0].name).toBe('新しい名前');
    expect(st.body.spots[0].photoUrl).toBeDefined(); // 写真は保持
  });

  it('作成者以外は編集・削除できない', async () => {
    const r = await req('PUT', '/api/rooms/test-room/spots/spot-0001', { spot: spot({ createdById: 'user-bbbb', updatedAt: 99 }) });
    expect(r.status).toBe(403);
    const d = await req('DELETE', '/api/rooms/test-room/spots/spot-0001?userId=user-bbbb');
    expect(d.status).toBe(403);
  });

  it('入力検証', async () => {
    expect((await req('PUT', '/api/rooms/test-room/spots/spot-0002', { spot: spot({ lat: 200 }) })).status).toBe(400);
    expect((await req('PUT', '/api/rooms/test-room/spots/spot-0002', { spot: spot({ category: 'x' }) })).status).toBe(400);
    expect((await req('PUT', '/api/rooms/test-room/spots/spot-0002', { spot: spot({ name: '  ' }) })).status).toBe(400);
    expect((await req('PUT', '/api/rooms/test-room/spots/spot-0002', { spot: spot(), photoData: 'data:image/jpeg;base64,AAAA' })).status).toBe(400);
    expect((await req('PUT', '/api/rooms/test-room/spots/spot-0002', { spot: spot(), photoData: 'data:image/svg+xml;base64,AAAA' })).status).toBe(400);
    expect((await req('GET', '/api/rooms/BAD!/state')).status).toBe(400);
    expect((await req('GET', '/uploads/..%2F..%2Fetc%2Fpasswd')).status).toBe(404);
    const r = await fetch(base + '/api/rooms/test-room/spots/spot-0002', { method: 'PUT', body: '{not json', headers: { 'Content-Type': 'application/json' } });
    expect(r.status).toBe(400);
  });

  it('訪問（スタンプ）の記録と取り消し', async () => {
    expect((await req('PUT', '/api/rooms/test-room/visits/spot-0001', { userId: 'user-cccc', nickname: 'c', at: 5 })).status).toBe(200);
    expect((await req('PUT', '/api/rooms/test-room/visits/spot-0001', { userId: 'user-cccc', nickname: 'c', at: 9 })).status).toBe(200);
    let st = await req('GET', '/api/rooms/test-room/state');
    expect(st.body.visits['spot-0001']['user-cccc'].at).toBe(5); // 最初に行った日時を保持
    expect((await req('PUT', '/api/rooms/test-room/visits/nope-0001', { userId: 'user-cccc', at: 5 })).status).toBe(404);
    await req('DELETE', '/api/rooms/test-room/visits/spot-0001?userId=user-cccc');
    st = await req('GET', '/api/rooms/test-room/state');
    expect(st.body.visits['spot-0001']).toBeUndefined();
  });

  it('削除後は墓標が残り、同じIDの再作成は拒否', async () => {
    expect((await req('DELETE', '/api/rooms/test-room/spots/spot-0001?userId=user-aaaa')).status).toBe(200);
    const st = await req('GET', '/api/rooms/test-room/state');
    expect(st.body.spots).toHaveLength(0);
    expect(st.body.deleted['spot-0001']).toBeTypeOf('number');
    expect((await req('PUT', '/api/rooms/test-room/spots/spot-0001', { spot: spot({ updatedAt: 1000 }) })).status).toBe(410);
  });

  it('同時書き込みでもデータが失われない', async () => {
    await Promise.all(
      Array.from({ length: 30 }, (_, i) => req('PUT', `/api/rooms/race-room/spots/race-${String(i).padStart(4, '0')}`, { spot: spot() })),
    );
    const st = await req('GET', '/api/rooms/race-room/state');
    expect(st.body.spots).toHaveLength(30);
    // ディスク上のファイルも正しい JSON
    const file = JSON.parse(await readFile(path.join(dir, 'rooms', 'race-room.json'), 'utf8'));
    expect(Object.keys(file.spots)).toHaveLength(30);
    // 再起動後も読める
    const s2 = new RoomStore(dir);
    expect((await s2.getState('race-room')).spots).toHaveLength(30);
  });
});
