import { VARIABLE_SPEED } from '../config/training-config'
import type { SegmentImportance, SpeedBand } from '../types/passage'

/**
 * Variable Speed Reading の評価。
 *
 * 鍛えるのは「情報の価値に応じて読む速度を切り替える力」であり、
 * 速く読めたかどうかではない。したがって採点は CPM ではなく、
 * 推奨帯とどれだけ一致したかで行う。
 */
const BAND_ORDER: SpeedBand[] = ['slow', 'normal', 'fast']

/** 重要な区間（主張・核心）を速く流した場合は追加で減点する。 */
const CRITICAL: SegmentImportance[] = ['claim', 'key']

export interface SegmentChoice {
  paragraphIndex: number
  importance: SegmentImportance
  recommendedBand: SpeedBand
  chosenBand: SpeedBand
  /** その区間に滞在した時間 */
  dwellMs: number
}

export interface SegmentFeedback {
  paragraphIndex: number
  importance: SegmentImportance
  recommendedBand: SpeedBand
  chosenBand: SpeedBand
  dwellMs: number
  score: number
  message: string
}

export interface VariableSpeedResult {
  /** 0–100 */
  score: number
  matched: number
  total: number
  segments: SegmentFeedback[]
  /** 速度を落とすべきだったのに速く読んだ区間 */
  shouldHaveSlowed: SegmentFeedback[]
  /** 速く通過してよかったのに時間をかけた区間 */
  couldHaveSkimmed: SegmentFeedback[]
}

const IMPORTANCE_LABELS: Record<SegmentImportance, string> = {
  known: '既知の情報',
  example: '具体例',
  evidence: '根拠',
  claim: '主張',
  key: '核心',
}

function bandDistance(a: SpeedBand, b: SpeedBand): number {
  return Math.abs(BAND_ORDER.indexOf(a) - BAND_ORDER.indexOf(b))
}

function scoreSegment(choice: SegmentChoice): number {
  const distance = bandDistance(choice.recommendedBand, choice.chosenBand)
  const base =
    distance === 0
      ? VARIABLE_SPEED.exactScore
      : distance === 1
        ? VARIABLE_SPEED.adjacentScore
        : VARIABLE_SPEED.oppositeScore

  const skippedCritical =
    CRITICAL.includes(choice.importance) && choice.chosenBand === 'fast'
      ? VARIABLE_SPEED.criticalSkipPenalty
      : 0

  return Math.max(0, base - skippedCritical)
}

function messageFor(choice: SegmentChoice, score: number): string {
  const label = IMPORTANCE_LABELS[choice.importance]
  if (score === VARIABLE_SPEED.exactScore) return `${label}を適切な速度で読めています`
  if (CRITICAL.includes(choice.importance) && choice.chosenBand === 'fast') {
    return `${label}を速く読み飛ばしています。ここは落として読む場面です`
  }
  if (bandDistance(choice.recommendedBand, choice.chosenBand) >= 1) {
    const shouldSlow = BAND_ORDER.indexOf(choice.recommendedBand) < BAND_ORDER.indexOf(choice.chosenBand)
    return shouldSlow
      ? `${label}をもう少し落として読むと取りこぼしが減ります`
      : `${label}にかけた時間が多めです。ここはもう少し速く通過できます`
  }
  return `${label}を適切な速度で読めています`
}

export function scoreVariableSpeed(choices: readonly SegmentChoice[]): VariableSpeedResult {
  const segments: SegmentFeedback[] = choices.map((choice) => {
    const score = scoreSegment(choice)
    return {
      paragraphIndex: choice.paragraphIndex,
      importance: choice.importance,
      recommendedBand: choice.recommendedBand,
      chosenBand: choice.chosenBand,
      dwellMs: choice.dwellMs,
      score,
      message: messageFor(choice, score),
    }
  })

  const total = segments.length
  const matched = segments.filter((s) => s.recommendedBand === s.chosenBand).length

  return {
    score:
      total === 0 ? 0 : Math.round(segments.reduce((sum, s) => sum + s.score, 0) / total),
    matched,
    total,
    segments,
    shouldHaveSlowed: segments.filter(
      (s) =>
        BAND_ORDER.indexOf(s.chosenBand) > BAND_ORDER.indexOf(s.recommendedBand) &&
        s.recommendedBand === 'slow',
    ),
    couldHaveSkimmed: segments.filter(
      (s) =>
        BAND_ORDER.indexOf(s.chosenBand) < BAND_ORDER.indexOf(s.recommendedBand) &&
        s.recommendedBand === 'fast',
    ),
  }
}

/** 速度帯に対応する目標 CPM。ペーサーの速度を決めるのに使う。 */
export function cpmForBand(targetCpm: number, band: SpeedBand): number {
  return Math.round(targetCpm * VARIABLE_SPEED.bandMultiplier[band])
}
