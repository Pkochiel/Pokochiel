import { RECALL, SCORING } from '../config/training-config'

/**
 * 自己評価は 0 / 25 / 50 / 75 / 100 の 5 段階。
 * 範囲外や中間の値が入っても、最も近い段階に丸めて保存する。
 */
export function normalizeRecallScore(value: number): number {
  const steps = RECALL.selfAssessmentSteps
  const first = steps[0] ?? 0
  return steps.reduce<number>(
    (nearest, step) => (Math.abs(step - value) < Math.abs(nearest - value) ? step : nearest),
    first,
  )
}

export interface RecallAxisInput {
  /** 直後想起 0–100 */
  immediate: number | null
  /** 翌日想起 0–100 */
  delayed: number | null
}

/**
 * Skill Radar の Recall 軸。
 * 長期記憶を重く見るため、翌日想起に重みを置く。片方しかなければそれを使う。
 */
export function combineRecallScores({ immediate, delayed }: RecallAxisInput): number | null {
  if (immediate === null && delayed === null) return null
  if (delayed === null) return immediate
  if (immediate === null) return delayed
  const w = SCORING.delayedRecallWeight
  return Math.round(immediate * (1 - w) + delayed * w)
}
