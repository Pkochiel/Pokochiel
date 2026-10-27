import { createRandom, hashString, seededShuffle } from '../../util/seeded-shuffle'

/**
 * 数字ランダム（BTRメソッド 認知視野拡大）
 *
 * 1〜99 が画面の中にランダムにちりばめられている。それを **1から順に拾う**。
 * 制限時間内にどこまで到達できたかがスコアになる。
 * **2枚のシートを続けて行う。** 公開スコアが4つ並んでいたのは、
 * 別の種目のぶんも一緒に並べていたためで、この種目自体は2枚である。
 *
 * 盤面を格子で作らず散らすのは、次に拾う数の位置が予測できないようにするため。
 * 整列していると視線が行を走るだけになり、盤面全体を走査する訓練にならない。
 */

export const NUMBER_RANDOM = {
  /** 盤面に置く数の最大値。1〜99。 */
  max: 99,
  /** シートの枚数 */
  sheets: 2,
  /**
   * 1枚あたりの制限時間（ms）の段階。基準に届いたら次に短いものへ。
   * 公開スコアの到達数がおおむね20前後であることから、初級を60秒に置いている。
   */
  timeLimits: [60_000, 45_000, 40_000, 35_000, 30_000],
  /** 次の段へ上がる到達数（2枚の平均） */
  advanceReached: 30,
  /** ひとつ前の段へ戻る到達数 */
  fallbackReached: 15,
  /** 散らすときの格子。この格子の中で位置を揺らして重なりを防ぐ。 */
  gridColumns: 10,
  gridRows: 10,
} as const

export interface ScatterPoint {
  readonly value: number
  /** 盤面内の位置（0–1）。描画側が幅・高さに掛けて使う。 */
  readonly x: number
  readonly y: number
}

export interface ScatterSheet {
  readonly id: string
  readonly points: readonly ScatterPoint[]
  readonly max: number
}

/**
 * 1枚ぶんの盤面。
 *
 * 格子のマスをひとつずつ使い、その中で位置を揺らす。
 * 完全な乱数で置くと数字どうしが重なって読めなくなるため。
 */
export function buildNumberRandomSheet(seed: string, sheetIndex: number): ScatterSheet {
  const { max, gridColumns, gridRows } = NUMBER_RANDOM
  const cells = gridColumns * gridRows
  const sheetSeed = `${seed}:number-random:${sheetIndex}`

  // どのマスを使うかを選び、そこに 1..max を順不同で配る。
  const chosenCells = seededShuffle(
    Array.from({ length: cells }, (_, i) => i),
    `${sheetSeed}:cells`,
  ).slice(0, max)

  const values = seededShuffle(
    Array.from({ length: max }, (_, i) => i + 1),
    `${sheetSeed}:values`,
  )

  const random = createRandom(hashString(`${sheetSeed}:jitter`))
  // マスの端まで寄せると隣とくっつくので、中央寄りに収める。
  const inset = 0.2

  const points = chosenCells.map((cell, index): ScatterPoint => {
    const column = cell % gridColumns
    const row = Math.floor(cell / gridColumns)
    const jitterX = inset + random() * (1 - inset * 2)
    const jitterY = inset + random() * (1 - inset * 2)
    return {
      value: values[index] ?? index + 1,
      x: (column + jitterX) / gridColumns,
      y: (row + jitterY) / gridRows,
    }
  })

  return { id: `number-random-${sheetIndex}`, points, max }
}

/** 全部の枚数ぶんの盤面。 */
export function buildNumberRandomSheets(seed: string): ScatterSheet[] {
  return Array.from({ length: NUMBER_RANDOM.sheets }, (_, index) =>
    buildNumberRandomSheet(seed, index),
  )
}

export interface SequentialResult {
  /** どこまで到達したか。これが主スコア。 */
  readonly reached: number
  /** 誤った数を押した回数 */
  readonly wrong: number
  readonly max: number
}

/**
 * 押した数の並びから到達数を出す。
 *
 * 1 から順に押せているあいだだけ進む。順番を飛ばした押下は誤りとして数え、
 * 到達数は進めない（適当に押して数字だけ上げられないようにする）。
 */
export function scoreSequential(taps: readonly number[], max: number): SequentialResult {
  let reached = 0
  let wrong = 0

  for (const tap of taps) {
    if (tap === reached + 1 && reached < max) reached += 1
    else wrong += 1
  }

  return { reached, wrong, max }
}

export interface NumberRandomResult {
  /** 各シートの到達数。記録にはこの並びをそのまま残す（「22・20・18・24」の形）。 */
  readonly attempts: readonly number[]
  /** 主スコア。全部の枚の合計。 */
  readonly reached: number
  readonly wrong: number
  /** 各枚の平均。レベル判定に使う。 */
  readonly average: number
}

export function combineNumberRandom(results: readonly SequentialResult[]): NumberRandomResult {
  const attempts = results.map((result) => result.reached)
  const reached = attempts.reduce((sum, value) => sum + value, 0)

  return {
    attempts,
    reached,
    wrong: results.reduce((sum, result) => sum + result.wrong, 0),
    average: results.length === 0 ? 0 : Math.round(reached / results.length),
  }
}
