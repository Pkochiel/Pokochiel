import { describe, expect, it } from 'vitest';
import { parseRoomState, parseSpot, validateDraft } from './validation';
import { rankFor, computeBadges, isInJapan } from './achievements';
import { distanceM, formatDistance } from './geo';

describe('parseRoomState', () => {
  it('壊れたデータや null でも空の状態を返す', () => {
    expect(parseRoomState(null).spots).toEqual({});
    expect(parseRoomState('garbage').queue).toEqual([]);
    expect(parseRoomState({ spots: 5, stamps: [], queue: 'x' }).stamps).toEqual({});
  });
  it('部分的に壊れていても有効な要素は救出する', () => {
    const s = parseRoomState({
      spots: {
        ok: { id: 'ok', name: '湯', category: 'onsen', lat: 35, lng: 139 },
        badLat: { id: 'badLat', name: 'x', category: 'onsen', lat: 999, lng: 0 },
        badCat: { id: 'badCat', name: 'x', category: 'zzz', lat: 0, lng: 0 },
      },
      stamps: { ok: { spotId: 'ok', at: 1, name: '湯', category: 'onsen', tilt: 99 }, bad: { spotId: 'bad' } },
      queue: [{ kind: 'stamp', spotId: 'ok', at: 1 }, { kind: 'evil', spotId: 'x' }, { kind: 'stamp', spotId: 'y' }],
    });
    expect(Object.keys(s.spots)).toEqual(['ok']);
    expect(Object.keys(s.stamps)).toEqual(['ok']);
    expect(s.stamps.ok!.tilt).toBe(15);
    expect(s.queue).toEqual([{ kind: 'stamp', spotId: 'ok', at: 1 }]);
  });
  it('危険な写真URLは捨てる', () => {
    const sp = parseSpot({ id: 'a', name: 'a', category: 'cafe', lat: 0, lng: 0, photoUrl: 'javascript:alert(1)' });
    expect(sp?.photoUrl).toBeUndefined();
    expect(parseSpot({ id: 'a', name: 'a', category: 'cafe', lat: 0, lng: 0, photoUrl: '/uploads/x.jpg' })?.photoUrl).toBe('/uploads/x.jpg');
  });
});

describe('validateDraft', () => {
  it('必須項目をチェック', () => {
    const e = validateDraft({ name: ' ', category: '', lat: null, lng: null, address: '', comment: '' });
    expect(Object.keys(e).sort()).toEqual(['category', 'location', 'name']);
  });
  it('正しい入力ならエラーなし（海外の座標もOK）', () => {
    expect(validateDraft({ name: 'Eiffel', category: 'sightseeing', lat: 48.8584, lng: 2.2945, address: '', comment: '' })).toEqual({});
  });
});

describe('achievements', () => {
  it('称号と次の称号までの進捗', () => {
    expect(rankFor(0).current.title).toBe('たびのはじまり');
    const r = rankFor(4);
    expect(r.current.min).toBe(3);
    expect(r.next?.min).toBe(5);
    expect(r.progress).toBeCloseTo(0.5);
    expect(rankFor(999).next).toBeNull();
  });
  it('海外スタンプでバッジ獲得', () => {
    const spots = [{ id: 'p', name: 'Paris', category: 'sightseeing' as const, lat: 48.85, lng: 2.35, address: '', comment: '', createdBy: '', createdById: '', createdAt: 0, updatedAt: 0 }];
    const b = computeBadges([{ spotId: 'p', at: 1, name: 'Paris', category: 'sightseeing', onSite: false, tilt: 0 }], spots);
    expect(b.find((x) => x.id === 'overseas')?.earned).toBe(true);
    expect(b.find((x) => x.id === 'sightseeing-1')?.earned).toBe(true);
    expect(b.find((x) => x.id === 'onsen-1')?.earned).toBe(false);
  });
  it('日本判定', () => {
    expect(isInJapan(35.68, 139.76)).toBe(true);
    expect(isInJapan(26.2, 127.68)).toBe(true); // 那覇
    expect(isInJapan(48.85, 2.35)).toBe(false);
  });
});

describe('geo', () => {
  it('東京駅〜大阪駅はおよそ400km', () => {
    const d = distanceM({ lat: 35.681, lng: 139.767 }, { lat: 34.702, lng: 135.495 });
    expect(d).toBeGreaterThan(390_000);
    expect(d).toBeLessThan(410_000);
    expect(formatDistance(420)).toBe('420m');
    expect(formatDistance(1500)).toBe('1.5km');
  });
});
