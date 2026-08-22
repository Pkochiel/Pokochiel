import { hashString, seededShuffle } from '../../util/seeded-shuffle'
import { buildSearchSheet, type SearchSheet } from './visual-search'

/**
 * BTRメソッドの盤面。
 *
 * 教室の教材は使わない。盤面は日付を種にした擬似乱数で生成する。
 * 同じ日なら同じ盤、翌日は別の盤になる。
 */

/** 漢数字一行で使う記号。一〜十。 */
export const KANJI_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const

/**
 * 漢数字一行の盤面。
 *
 * 一〜十の漢数字で埋めた盤から、対象の数字だけを拾う。
 * 教室では「一を探すターン」「二を探すターン」「三を探すターン」があり、各90秒。
 */
export const KANJI_LINE = {
  /** 横に並ぶ数 */
  columns: 30,
  /** 縦に並ぶ数 */
  rows: 3,
  /** ターンごとに探す対象。この順で3ターン行う。 */
  targets: ['一', '二', '三'] as const,
  /** 1ターンの制限時間（ms） */
  turnMs: 90_000,
} as const

export function buildKanjiLineSheet(seed: string, target: string): SearchSheet {
  return buildSearchSheet({
    id: `kanji-line-${target}`,
    columns: KANJI_LINE.columns,
    rows: KANJI_LINE.rows,
    symbols: KANJI_NUMERALS,
    targetLabel: target,
    // 一〜十が均等に出るなら1/10。均等より少し多めに置き、90秒で拾い切れる量にする。
    targetRatio: 0.12,
    seed,
  })
}

/** 漢数字一行の3ターンぶんの盤面。 */
export function buildKanjiLineSheets(seed: string): SearchSheet[] {
  return KANJI_LINE.targets.map((target) => buildKanjiLineSheet(seed, target))
}

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

/**
 * 数字ランダム。
 *
 * 4種類のシートを使うことは確認済み。拾い方（1から順に拾うのか、対象を探すのか）は
 * 未確認のため、いまは「散らばった数字を1から順に拾う」で作っている。
 * docs/BTR_METHOD.md §9 の未回答項目。判明したら差し替えること。
 */
export const NUMBER_RANDOM = {
  columns: 7,
  rows: 7,
  /** シートの枚数。公開スコアが4つ並ぶことから4枚。 */
  sheets: 4,
  /** 1枚あたりの制限時間（ms） */
  sheetMs: 30_000,
} as const

export interface SequentialSheet {
  readonly id: string
  readonly columns: number
  readonly rows: number
  /** 盤面。index 位置にどの数字があるか。 */
  readonly numbers: readonly number[]
  /** 拾うべき数の最大値 */
  readonly max: number
}

/** 1 から max までを盤面に散らす。順に拾っていく。 */
export function buildNumberRandomSheet(seed: string, sheetIndex: number): SequentialSheet {
  const columns = NUMBER_RANDOM.columns
  const rows = NUMBER_RANDOM.rows
  const size = columns * rows
  const numbers = seededShuffle(
    Array.from({ length: size }, (_, i) => i + 1),
    `${seed}:number-random:${sheetIndex}`,
  )

  return { id: `number-random-${sheetIndex}`, columns, rows, numbers, max: size }
}

export function buildNumberRandomSheets(seed: string): SequentialSheet[] {
  return Array.from({ length: NUMBER_RANDOM.sheets }, (_, index) =>
    buildNumberRandomSheet(seed, index),
  )
}
