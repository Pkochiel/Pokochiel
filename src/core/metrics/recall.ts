import { RECALL, SCORING } from '../config/training-config'

/**
 * Recall の評価。
 *
 * 自己評価だけに依存すると、模範解答を見た後の印象で点が動きやすい。
 * そこで主要値は「Key Points のうち、いくつを実際に思い出せていたか」とし、
 * 自己評価は補助指標として併記するに留める。
 *
 * 将来 LLM による意味的一致度の評価に差し替えるため、
 * 評価器はインタフェースとして分離してある。実装を入れ替えるだけで、
 * 呼び出し側（UI・保存処理）は変更しなくてよい。
 */
export interface RecallEvaluationInput {
  keyPoints: readonly string[]
  /** ユーザーが「思い出せていた」と選んだ Key Point の添字 */
  recalledKeyPointIndexes: readonly number[]
  /** 補助指標としての自己評価（0/25/50/75/100）。未選択なら null */
  selfAssessment: number | null
  /** 想起の記述そのもの。将来の意味的評価のために保持する */
  text: string
}

export type RecallEvaluationMethod = 'key_points' | 'self_assessment' | 'semantic'

export interface RecallEvaluation {
  /** 主要値（0–100） */
  score: number
  method: RecallEvaluationMethod
  recalledCount: number
  totalCount: number
  /** 補助指標。主要値とずれている場合は結果画面で併記する */
  selfAssessment: number | null
}

export interface RecallEvaluator {
  evaluate(input: RecallEvaluationInput): RecallEvaluation
}

/**
 * Key Point の照合による評価。
 * Key Point が存在しない教材では自己評価に退避する。
 */
export const keyPointRecallEvaluator: RecallEvaluator = {
  evaluate({ keyPoints, recalledKeyPointIndexes, selfAssessment }) {
    const totalCount = keyPoints.length
    const recalledCount = new Set(
      recalledKeyPointIndexes.filter((index) => index >= 0 && index < totalCount),
    ).size

    if (totalCount === 0) {
      return {
        score: selfAssessment ?? 0,
        method: 'self_assessment',
        recalledCount: 0,
        totalCount: 0,
        selfAssessment,
      }
    }

    return {
      score: Math.round((recalledCount / totalCount) * 100),
      method: 'key_points',
      recalledCount,
      totalCount,
      selfAssessment,
    }
  },
}

export function evaluateRecall(
  input: RecallEvaluationInput,
  evaluator: RecallEvaluator = keyPointRecallEvaluator,
): RecallEvaluation {
  return evaluator.evaluate(input)
}


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
