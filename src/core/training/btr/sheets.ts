import { hashString, seededShuffle } from '../../util/seeded-shuffle'
import { buildSearchSheet, type SearchSheet } from './visual-search'

/**
 * スピードチェックの盤面。
 *
 * 教室の教材は使わない。盤面は日付を種にした擬似乱数で生成する。
 * 同じ日なら同じ盤、翌日は別の盤になる。
 *
 * 漢数字一行は縦書きの列という別の形なので pattern-sheet.ts にある。
 */

/** スピードチェックで使う方角漢字。 */
export const DIRECTION_KANJI = ['東', '西', '南', '北'] as const

/**
 * 方角漢字の2文字の組み合わせ。同じ字を重ねたものは作らない。
 * 東西・西東のように順序違いも別の組み合わせとして扱う（字面が似るほど課題になる）。
 */
export const DIRECTION_PAIRS: readonly string[] = DIRECTION_KANJI.flatMap((first) =>
  DIRECTION_KANJI.filter((second) => second !== first).map((second) => `${first}${second}`),
)

/**
 * スピードチェックの盤面。
 *
 * 方角漢字の組み合わせで埋めた盤から、指定された組み合わせを探す。
 * 似た字面が大量に並ぶため、字形ではなく組み合わせとして掴む必要がある。
 */
export const SPEED_CHECK = {
  columns: 10,
  rows: 10,
  /** 1ターンの制限時間（ms） */
  turnMs: 60_000,
} as const

export function buildSpeedCheckSheet(seed: string, target: string): SearchSheet {
  return buildSearchSheet({
    id: `speed-check-${target}`,
    columns: SPEED_CHECK.columns,
    rows: SPEED_CHECK.rows,
    symbols: DIRECTION_PAIRS,
    targetLabel: target,
    // 12通りあるので均等なら 1/12。探し出す手応えが残る程度に置く。
    targetRatio: 0.1,
    seed,
  })
}

/** その回に探す組み合わせ。日ごとに変える。 */
export function speedCheckTargetFor(seed: string): string {
  const index = hashString(seed) % DIRECTION_PAIRS.length
  return DIRECTION_PAIRS[index] ?? '東西'
}
