import type { Category, Spot, Stamp } from '../types';
import { CATEGORIES } from './categories';

export interface Rank {
  min: number;
  title: string;
  emoji: string;
}

/** 総スタンプ数による称号 */
export const RANKS: Rank[] = [
  { min: 0, title: 'たびのはじまり', emoji: '🥚' },
  { min: 1, title: 'かけだし旅人', emoji: '🐣' },
  { min: 3, title: 'ぶらり散策家', emoji: '🚶' },
  { min: 5, title: 'スポットハンター', emoji: '🎯' },
  { min: 10, title: 'さすらいの達人', emoji: '🧭' },
  { min: 20, title: 'スタンプ名人', emoji: '🏅' },
  { min: 35, title: '全国行脚マスター', emoji: '🗾' },
  { min: 50, title: '伝説の旅人', emoji: '👑' },
];

export function rankFor(count: number): { current: Rank; next: Rank | null; progress: number } {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (count >= r.min) idx = i;
  });
  const current = RANKS[idx]!;
  const next = RANKS[idx + 1] ?? null;
  const progress = next ? (count - current.min) / (next.min - current.min) : 1;
  return { current, next, progress: Math.max(0, Math.min(1, progress)) };
}

export interface Badge {
  id: string;
  emoji: string;
  title: string;
  description: string;
  earned: boolean;
  /** 0..1 */
  progress: number;
  progressLabel: string;
}

const CAT_BADGE: Record<Category, [string, string][]> = {
  onsen: [['ひとっ風呂', '温泉スタンプ1個'], ['湯めぐり名人', '温泉スタンプ5個']],
  gourmet: [['はらぺこ探検隊', 'グルメスタンプ1個'], ['食い倒れ王', 'グルメスタンプ5個']],
  cafe: [['ひと休み', 'カフェスタンプ1個'], ['カフェマイスター', 'カフェスタンプ5個']],
  sightseeing: [['観光デビュー', '観光スタンプ1個'], ['名所コンプリーター', '観光スタンプ5個']],
  nature: [['深呼吸', '自然スタンプ1個'], ['大自然の友', '自然スタンプ5個']],
  other: [['寄り道上手', 'その他スタンプ1個'], ['なんでも探検家', 'その他スタンプ5個']],
};

export function computeBadges(stamps: Stamp[], spots: Spot[]): Badge[] {
  const byCat = new Map<Category, number>();
  for (const s of stamps) byCat.set(s.category, (byCat.get(s.category) ?? 0) + 1);
  const badges: Badge[] = [];
  for (const c of CATEGORIES) {
    const n = byCat.get(c.id) ?? 0;
    const [[t1, d1], [t2, d2]] = CAT_BADGE[c.id] as [[string, string], [string, string]];
    badges.push({ id: `${c.id}-1`, emoji: c.emoji, title: t1, description: d1, earned: n >= 1, progress: Math.min(1, n), progressLabel: `${Math.min(n, 1)}/1` });
    badges.push({ id: `${c.id}-5`, emoji: c.emoji, title: t2, description: d2, earned: n >= 5, progress: Math.min(1, n / 5), progressLabel: `${Math.min(n, 5)}/5` });
  }
  const onSite = stamps.filter((s) => s.onSite).length;
  badges.push({ id: 'onsite-3', emoji: '📡', title: '現地主義', description: '現地認定スタンプ3個', earned: onSite >= 3, progress: Math.min(1, onSite / 3), progressLabel: `${Math.min(onSite, 3)}/3` });
  const cats = byCat.size;
  badges.push({ id: 'all-cats', emoji: '🌈', title: 'オールラウンダー', description: '全カテゴリのスタンプを集める', earned: cats >= CATEGORIES.length, progress: cats / CATEGORIES.length, progressLabel: `${cats}/${CATEGORIES.length}` });
  const overseas = stamps.filter((st) => {
    const sp = spots.find((x) => x.id === st.spotId);
    return sp ? !isInJapan(sp.lat, sp.lng) : false;
  }).length;
  badges.push({ id: 'overseas', emoji: '✈️', title: '海を越えて', description: '海外スポットのスタンプ1個', earned: overseas >= 1, progress: Math.min(1, overseas), progressLabel: `${Math.min(overseas, 1)}/1` });
  return badges;
}

/** 日本国内かどうかのおおまかな判定（バウンディングボックス） */
export function isInJapan(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 46 && lng >= 122 && lng <= 154;
}
