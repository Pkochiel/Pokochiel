import type { Category } from '../types';

export interface CategoryInfo {
  id: Category;
  label: string;
  emoji: string;
  /** スタンプのインク色 */
  ink: string;
  /** ピンの背景色 */
  color: string;
  /** スタンプに入る文字 */
  stampWord: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'onsen', label: '温泉', emoji: '♨️', ink: '#c8323c', color: '#e85d5d', stampWord: '湯' },
  { id: 'gourmet', label: 'グルメ', emoji: '🍜', ink: '#d0661d', color: '#f08a32', stampWord: '食' },
  { id: 'cafe', label: 'カフェ', emoji: '☕', ink: '#7a4a2a', color: '#a8714a', stampWord: '茶' },
  { id: 'sightseeing', label: '観光', emoji: '⛩️', ink: '#2c5aa0', color: '#4a7fd0', stampWord: '観' },
  { id: 'nature', label: '自然', emoji: '🌲', ink: '#2e7d4a', color: '#3fa463', stampWord: '景' },
  { id: 'other', label: 'その他', emoji: '📍', ink: '#6a4c9c', color: '#8c6cc4', stampWord: '印' },
];

const MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<Category, CategoryInfo>;

export function categoryInfo(id: Category): CategoryInfo {
  return MAP[id] ?? MAP.other;
}

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && v in MAP;
}
