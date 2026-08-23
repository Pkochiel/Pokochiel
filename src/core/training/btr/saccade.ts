import { hashString } from '../../util/seeded-shuffle'

/**
 * サッケイド（BTRメソッド 認知視野拡大）
 *
 * 実物のシート（PRESIDENT Family 掲載のもの）は、**印だけが並んだ紙**である。
 *
 *   たて  8本の縦線。各線の上端に ▼、下端に ▲
 *   よこ  8本の横線。各線の左端に ▶、右端に ◀
 *
 * 線は点線で、途中には何も書かれていない。**文字を一切介在させない。**
 * 端から端へ視線を往復させ、30秒で何往復できたかを数える。
 *
 * 向きは毎回ランダムに切り替わる（たて／よこの2種類）。
 *
 * ## 数え方について
 *
 * 教室では自分で往復数を数える。アプリでも同じにしてある。
 * 一度は「印が交互に点灯して、光った側を答える」形にしていたが、これは誤りだった。
 * 点灯を待って反応する課題になると、速さの上限が**反応時間**で決まってしまい、
 * 自分のペースで最速の眼球運動をするというこの種目の中身が消える。
 *
 * 自己申告なので数字は盛れる。それは紙のシートでも同じである。
 * 比べるのは自分の推移だけにする。
 */

export type SaccadeAxis = 'vertical' | 'horizontal'

export const SACCADE_AXES: readonly SaccadeAxis[] = ['vertical', 'horizontal']

export const SACCADE_AXIS_LABELS: Record<SaccadeAxis, string> = {
  vertical: 'たてサッケイド',
  horizontal: 'よこサッケイド',
}

export const SACCADE = {
  /** 1本の長さ（ms） */
  durationMs: 30_000,
  /** シートの線の本数。たては8列、よこは8行。 */
  lines: 8,
  /**
   * 段ごとの1往復あたりの目安時間（ms）。短くなるほど上の段。
   *
   * 級を判定するための目安であって、この速さに合わせて動かすものではない。
   * 公開スコアが30秒で50〜80往復なので、そこから逆算して置いた。
   * **教室が段を設けているかは確認できていない。**
   */
  intervalsMs: [700, 600, 500, 420, 360, 300],
} as const

/**
 * その回に行う向き。
 *
 * 教室では毎回ランダムに切り替わる。同じ日なら同じ向きになるよう日付を種にする
 * （画面を開き直しただけで課題が変わると、記録の意味が壊れるため）。
 */
export function saccadeAxisFor(seed: string): SaccadeAxis {
  const index = hashString(seed) % SACCADE_AXES.length
  return SACCADE_AXES[index] ?? 'horizontal'
}

export interface SaccadeResult {
  /** 往復数。これが記録するスコア。 */
  readonly laps: number
  /** シートを何周したか（8本を通し終えた回数） */
  readonly sheets: number
  /** 周回の途中で、いま何本目にいるか（0 始まり） */
  readonly line: number
  /** 実際に測った長さ（ms） */
  readonly elapsedMs: number
  /** 1分あたりに直した往復数。長さを変えても比べられるようにする。 */
  readonly perMinute: number
}

/**
 * 往復数から成績を出す。
 *
 * 数えるのは往復そのもので、周回数は「いま何本目か」を画面に出すための内訳である。
 * 8本を通し終えるごとに1周になる。
 */
export function scoreSaccade(laps: number, elapsedMs: number): SaccadeResult {
  const safeLaps = Math.max(0, Math.floor(laps))
  const lines = Math.max(1, SACCADE.lines)

  return {
    laps: safeLaps,
    sheets: Math.floor(safeLaps / lines),
    line: safeLaps % lines,
    elapsedMs,
    perMinute:
      elapsedMs <= 0 ? 0 : Math.round((safeLaps / (elapsedMs / 60_000)) * 10) / 10,
  }
}

export interface SaccadeLine {
  /** 何本目か（0 始まり） */
  readonly index: number
  /** 線の位置（0–1）。たてなら左からの位置、よこなら上からの位置。 */
  readonly offset: number
}

/**
 * シートの線。
 *
 * 等間隔に並べる。実物も等間隔で、間隔そのものに意味はない
 * （視線を動かす距離を一定に保つためのもの）。
 */
export function buildSaccadeSheet(lines: number = SACCADE.lines): SaccadeLine[] {
  const count = Math.max(0, Math.floor(lines))
  if (count === 0) return []
  return Array.from({ length: count }, (_, index) => ({
    index,
    // 両端に余白を残す。端に寄せると印が画面のふちに触れて見づらい。
    offset: count === 1 ? 0.5 : index / (count - 1),
  }))
}
