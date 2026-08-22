import { createRandom, hashString } from '../../util/seeded-shuffle'

/**
 * サッケイド（BTRメソッド 認知視野拡大）
 *
 * 上下（たて）または左右（よこ）のマーカー間で視線を往復させる。
 * 文字を介在させず、眼球運動だけに集中するのがこの種目の核心である。
 *
 * 教室では紙のシートを見て自分で往復数を数えるが、アプリで自己申告にすると
 * 数字だけが上がって訓練にならない。そのため次の形に置き換えている。
 *
 *   マーカーが交互に点灯する → 点灯した側を答える → 正答数を往復数とする
 *
 * 点灯側を知るには視線を動かすほかないので眼球運動は実際に起きる。
 * 「往復数」の絶対値は教室のスコアとは比較できない。比較するのは自分の推移だけ。
 */

export type SaccadeAxis = 'vertical' | 'horizontal'
export type SaccadeSide = 'start' | 'end'

export const SACCADE_AXES: readonly SaccadeAxis[] = ['vertical', 'horizontal']

export const SACCADE_AXIS_LABELS: Record<SaccadeAxis, string> = {
  vertical: 'たてサッケイド',
  horizontal: 'よこサッケイド',
}

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

export interface SaccadeStep {
  /** 何番目の点灯か（0 始まり） */
  readonly index: number
  /** どちら側が光るか */
  readonly side: SaccadeSide
  /** 点灯を始める時刻（ブロック開始からの ms） */
  readonly atMs: number
}

export const SACCADE = {
  /** 1本の長さ（ms） */
  durationMs: 30_000,
  /**
   * 段ごとの点灯間隔（ms）。短くなるほど上の段。
   *
   * 700ms は目で追って余裕がある速さ、300ms は先読みしないと追いつかない速さ。
   * 教室の紙のシートには点灯がないので、この刻みはこちらで置いたものである。
   */
  intervalsMs: [700, 600, 500, 420, 360, 300],
} as const

export interface SaccadeSchedule {
  readonly axis: SaccadeAxis
  readonly intervalMs: number
  readonly durationMs: number
  readonly steps: readonly SaccadeStep[]
}

export interface BuildSaccadeScheduleInput {
  readonly axis: SaccadeAxis
  /** 点灯の間隔（ms）。レベルが上がるほど短くなる。 */
  readonly intervalMs: number
  /** ブロックの長さ（ms） */
  readonly durationMs: number
  /** 左右どちらから始めるかを決める種 */
  readonly seed: string
}

/**
 * 点灯の予定表を作る。
 *
 * 単純な交互ではなく、ときどき同じ側が連続する。
 * 完全な交互だと目を閉じていてもリズムだけで当てられてしまい、
 * 「見て判断する」課題でなくなるため。
 */
export function buildSaccadeSchedule(input: BuildSaccadeScheduleInput): SaccadeSchedule {
  const { axis, intervalMs, durationMs, seed } = input
  if (intervalMs <= 0 || durationMs <= 0) {
    return { axis, intervalMs, durationMs, steps: [] }
  }

  const random = createRandom(hashString(`${seed}:${axis}`))
  const count = Math.floor(durationMs / intervalMs)
  const steps: SaccadeStep[] = []
  let side: SaccadeSide = random() < 0.5 ? 'start' : 'end'

  for (let index = 0; index < count; index += 1) {
    steps.push({ index, side, atMs: index * intervalMs })
    // 8回に1回ほど同じ側にとどめ、リズムだけで当たらないようにする。
    if (random() >= 0.125) side = side === 'start' ? 'end' : 'start'
  }

  return { axis, intervalMs, durationMs, steps }
}

export interface SaccadeAnswer {
  readonly index: number
  readonly side: SaccadeSide
}

export interface SaccadeResult {
  /** 正しく答えられた回数。これを往復数として記録する。 */
  readonly hits: number
  /** 誤った側を答えた回数 */
  readonly misses: number
  /** 答えないまま過ぎた回数 */
  readonly skipped: number
  /** 出題数 */
  readonly total: number
  /** 正答率（0–100）。レベルを上げてよいかの判断に使う。 */
  readonly accuracy: number
}

/** 点灯の予定表と回答から往復数を出す。 */
export function scoreSaccade(
  schedule: SaccadeSchedule,
  answers: readonly SaccadeAnswer[],
): SaccadeResult {
  const bySide = new Map<number, SaccadeSide>()
  // 同じ点灯に複数回答えた場合は最初のものだけを採る（連打で稼げないようにする）。
  for (const answer of answers) {
    if (!bySide.has(answer.index)) bySide.set(answer.index, answer.side)
  }

  let hits = 0
  let misses = 0
  for (const step of schedule.steps) {
    const answered = bySide.get(step.index)
    if (answered === undefined) continue
    if (answered === step.side) hits += 1
    else misses += 1
  }

  const total = schedule.steps.length
  const answered = hits + misses
  return {
    hits,
    misses,
    skipped: total - answered,
    total,
    accuracy: answered === 0 ? 0 : Math.round((hits / answered) * 100),
  }
}
