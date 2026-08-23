import { BP_SHEET } from './bp-sheet'
import { IMAGE_MEMORY } from './image-memory'
import { LOGICAL_TEST } from './logical-test'
import { NUMBER_RANDOM } from './number-random'
import { PATTERN_SHEET } from './pattern-sheet'
import { SACCADE } from './saccade'
import { SPEED_BOARD } from './speed-board'
import { SPEED_CHECK } from './sheets'
import { UNIT_BOOK } from './unit-book'
import { btrExercise, type BtrExercise } from './exercises'

/**
 * 級の進み方（BTRメソッド）。
 *
 * BTR の上達は「速く読めるようになったか」ではなく
 * **同じ課題を短い時間でこなせるか** で測る。だから級が上がると制限時間が縮む。
 * 速度を目標にすると、読んだつもりで飛ばすだけで数字が上がってしまう。
 *
 * 級は **種目ごとに独立**している。得意な種目に引きずられて
 * 苦手な種目まで難しくなる、という事故を起こさないため。
 *
 * 上がる条件に主スコアと正確さの両方を置いている種目がある。
 * 正確さだけを見ると、ゆっくり確実に拾って100%を保つ人が上がりつづけ、
 * 主スコアだけを見ると、当てずっぽうで数を稼ぐ人が上がってしまう。
 */

export type BtrJudgement = 'advance' | 'stay' | 'fallback'

/** 漢数字一行の3ターンぶんの対象の総数。1列に1つずつ入っている。 */
const patternSheetTotal = PATTERN_SHEET.columnCount * PATTERN_SHEET.targets.length

export interface LevelRule {
  /**
   * 段ごとの制限時間（ms）。短いほど上の段。
   * サッケイドだけは1往復にかける目安の時間で、そのほかは1試行の制限時間。
   */
  readonly timeLimits: readonly number[]
  /** 上がるのに要る主スコア。0 なら見ない。 */
  readonly advanceScore: number
  /** 上がるのに要る正確さ（%）。null なら見ない。 */
  readonly advanceAccuracy: number | null
  /** これを下回ったら下がる主スコア。0 なら見ない。 */
  readonly fallbackScore: number
  /** これを下回ったら下がる正確さ（%）。null なら見ない。 */
  readonly fallbackAccuracy: number | null
  /**
   * 制限時間が「1回あたりの目安」である種目。
   *
   * ほとんどの種目では、制限時間が縮むと課題そのものが難しくなるので、
   * 求めるスコアは据え置きでよい。サッケイドだけは30秒で固定されていて、
   * 段が上がっても課題は変わらない（縮むのは1往復にかける目安の時間）。
   * そのままだと一度上がったあと同じ成績で上がりつづけてしまうので、
   * **求める往復数を段に応じて増やす。**
   */
  readonly paceTarget?: boolean
  /** paceTarget の種目で、1回ぶんの長さ（ms）。往復数に直すのに使う。 */
  readonly totalMs?: number
}

/**
 * 種目ごとのはしご。
 *
 * 級を持たない種目（カウント呼吸法・かなひろい・読書）はここに載せない。
 * それらは数字そのものが伸びていくのを見る種目で、課す条件を変えない。
 */
export const LEVEL_RULES: Partial<Record<BtrExercise, LevelRule>> = {
  saccade: {
    // 段ごとの1往復あたりの目安時間。その段の往復数に直して判定する。
    timeLimits: SACCADE.intervalsMs,
    paceTarget: true,
    totalMs: SACCADE.durationMs,
    // 正確さを測れる種目ではない（自分で数えた往復数しかない）ので主スコアだけで見る。
    // 実際の閾値は段ごとに計算される（advanceScore は使わない）。
    advanceScore: 0,
    advanceAccuracy: null,
    fallbackScore: 0,
    fallbackAccuracy: null,
  },
  number_random: {
    timeLimits: NUMBER_RANDOM.timeLimits,
    advanceScore: NUMBER_RANDOM.advanceReached,
    advanceAccuracy: null,
    fallbackScore: NUMBER_RANDOM.fallbackReached,
    fallbackAccuracy: null,
  },
  unit_book: {
    timeLimits: UNIT_BOOK.timeLimits,
    advanceScore: 0,
    advanceAccuracy: UNIT_BOOK.advanceAccuracy,
    fallbackScore: 0,
    fallbackAccuracy: UNIT_BOOK.fallbackAccuracy,
  },
  pattern_sheet: {
    // 実物のシートは1ターン90秒で固定されている。段を作るために縮めているが、
    // 教室がそうしているかは確認できていない（docs/BTR_METHOD.md §9）。
    timeLimits: [PATTERN_SHEET.turnMs, 75_000, 60_000, 50_000, 40_000],
    // 1列に対象がちょうど1つあるので、拾えた数はそのまま到達した列数になる。
    // 3ターンぶんの合計に対する割合で置く。
    advanceScore: Math.round(patternSheetTotal * PATTERN_SHEET.advanceRatio),
    advanceAccuracy: 90,
    fallbackScore: Math.round(patternSheetTotal * PATTERN_SHEET.fallbackRatio),
    fallbackAccuracy: 60,
  },
  bp_sheet: {
    timeLimits: BP_SHEET.lifetimeMs,
    advanceScore: 0,
    advanceAccuracy: BP_SHEET.advanceAccuracy,
    fallbackScore: 0,
    fallbackAccuracy: BP_SHEET.fallbackAccuracy,
  },
  speed_check: {
    timeLimits: [SPEED_CHECK.turnMs, 45_000, 35_000, 30_000, 25_000],
    // 盤には10個ある。全部拾えたら次の段へ。
    advanceScore: 10,
    advanceAccuracy: 90,
    fallbackScore: 5,
    fallbackAccuracy: 60,
  },
  logical_test: {
    timeLimits: LOGICAL_TEST.timeLimits,
    advanceScore: 0,
    advanceAccuracy: LOGICAL_TEST.advanceAccuracy,
    fallbackScore: 0,
    fallbackAccuracy: LOGICAL_TEST.fallbackAccuracy,
  },
  speed_board: {
    timeLimits: SPEED_BOARD.timeLimits,
    advanceScore: 0,
    advanceAccuracy: SPEED_BOARD.advanceAccuracy,
    fallbackScore: 0,
    fallbackAccuracy: SPEED_BOARD.fallbackAccuracy,
  },
  image_memory: {
    timeLimits: IMAGE_MEMORY.timeLimits,
    advanceScore: IMAGE_MEMORY.advanceRecalled,
    advanceAccuracy: null,
    fallbackScore: IMAGE_MEMORY.fallbackRecalled,
    fallbackAccuracy: null,
  },
}

export function levelRuleFor(exercise: BtrExercise): LevelRule | null {
  return LEVEL_RULES[exercise] ?? null
}

/** その種目のいちばん上の段。 */
export function topLevel(exercise: BtrExercise): number {
  const rule = levelRuleFor(exercise)
  return rule === null ? 0 : Math.max(0, rule.timeLimits.length - 1)
}

/** その段で課される制限時間（ms）。段を持たない種目は null。 */
export function timeLimitAt(exercise: BtrExercise, level: number): number | null {
  const rule = levelRuleFor(exercise)
  if (rule === null) return null
  const index = Math.min(Math.max(0, level), rule.timeLimits.length - 1)
  return rule.timeLimits[index] ?? null
}

export interface JudgeInput {
  readonly score: number
  /** 0–100。持たない種目は null。 */
  readonly accuracy: number | null
  /** そのとき課されていた段。paceTarget の種目で閾値を出すのに要る。 */
  readonly level?: number
}

/**
 * その段で求める主スコア。
 *
 * paceTarget の種目では、1回ぶんの長さを目安時間で割った往復数になる。
 * それ以外は段によらず一定。
 */
export function requiredScoreAt(
  rule: LevelRule,
  level: number,
  kind: 'advance' | 'fallback',
): number {
  if (rule.paceTarget !== true || rule.totalMs === undefined) {
    return kind === 'advance' ? rule.advanceScore : rule.fallbackScore
  }
  const index = Math.min(Math.max(0, level), rule.timeLimits.length - 1)
  const target = Math.round(rule.totalMs / (rule.timeLimits[index] ?? rule.totalMs))
  // 下がるのは、その段で求める数の半分にも届かなかったとき。
  return kind === 'advance' ? target : Math.round(target / 2)
}

/**
 * その回の成績から級を上げるか下げるかを決める。
 *
 * 上がるには決められた条件を**すべて**満たす必要がある。
 * どれかひとつでも下限を割ったら下がる。
 * 段を持たない種目は常に据え置き。
 */
export function judgeBtr(exercise: BtrExercise, result: JudgeInput): BtrJudgement {
  const rule = levelRuleFor(exercise)
  if (rule === null) return 'stay'

  const level = result.level ?? 0
  const advanceScore = requiredScoreAt(rule, level, 'advance')
  const fallbackScore = requiredScoreAt(rule, level, 'fallback')

  const accuracy = result.accuracy
  if (fallbackScore > 0 && result.score < fallbackScore) return 'fallback'
  if (
    rule.fallbackAccuracy !== null &&
    accuracy !== null &&
    accuracy < rule.fallbackAccuracy
  ) {
    return 'fallback'
  }

  const scoreOk = advanceScore <= 0 || result.score >= advanceScore
  const accuracyOk =
    rule.advanceAccuracy === null || (accuracy !== null && accuracy >= rule.advanceAccuracy)
  return scoreOk && accuracyOk ? 'advance' : 'stay'
}

/**
 * 次の回の級。
 *
 * はしごの外へは出ない。いちばん上で advance を出しても上がらないし、
 * いちばん下で fallback を出しても下がらない。
 */
export function nextLevel(
  exercise: BtrExercise,
  level: number,
  judgement: BtrJudgement,
): number {
  const max = topLevel(exercise)
  const current = Math.min(Math.max(0, level), max)
  if (judgement === 'advance') return Math.min(max, current + 1)
  if (judgement === 'fallback') return Math.max(0, current - 1)
  return current
}

export interface LevelHistoryEntry {
  readonly exercise: string
  readonly level: number | null
  readonly judgement: string | null
}

/**
 * 記録からいまの級を出す。
 *
 * 直近の回の「使った級」と「その回の判定」から次の級が決まる。
 * 級そのものを保存せず毎回ここで出すのは、判定の条件を変えたときに
 * 過去の記録から引き直せるようにするためである。
 */
export function currentLevel(
  exercise: BtrExercise,
  history: readonly LevelHistoryEntry[],
): number {
  if (!btrExercise(exercise).leveled) return 0

  let level = 0
  for (const entry of history) {
    if (entry.exercise !== exercise) continue
    const used = entry.level ?? level
    const judgement = entry.judgement
    level =
      judgement === 'advance' || judgement === 'fallback' || judgement === 'stay'
        ? nextLevel(exercise, used, judgement)
        : used
  }
  return Math.min(Math.max(0, level), topLevel(exercise))
}

/**
 * 級の表示。
 *
 * 級は数字が小さいほど上（10級 → 1級）という数え方をする。
 * 内側では 0 から数える段の番号を使っているので、表に出すときだけ裏返す。
 * 段を持たない種目には級がないので null を返す。
 */
export function levelLabel(exercise: BtrExercise, level: number): string | null {
  const rule = levelRuleFor(exercise)
  if (rule === null) return null
  const max = topLevel(exercise)
  const current = Math.min(Math.max(0, level), max)
  return `${rule.timeLimits.length - current}級`
}
