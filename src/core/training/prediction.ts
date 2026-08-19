import { PREDICTION } from '../config/training-config'
import type { PredictionQuality } from '../types/passage'

/**
 * Prediction Reading の評価。
 *
 * 鍛えるのは「次に何が来るかを仮説として持ちながら読む力」。
 * 完全一致は求めず、論理の方向と論点の合致で採点する。
 * 自由記述には加点するが、それは正確さへの加点ではなく、
 * 予測を言語化したこと自体への加点である。
 */
export interface PredictionAnswer {
  quality: PredictionQuality
  /** 自由記述で予測を書いたか */
  hasWrittenPrediction: boolean
}

const QUALITY_SCORE: Record<PredictionQuality, number> = {
  correct: PREDICTION.correctScore,
  partial: PREDICTION.partialScore,
  miss: PREDICTION.missScore,
}

export interface PredictionScore {
  /** 0–100 */
  score: number
  correct: number
  partial: number
  miss: number
  total: number
  /** 論理方向は合っていた割合（correct + partial） */
  directionRate: number
}

export function scorePrediction(answers: readonly PredictionAnswer[]): PredictionScore {
  const total = answers.length
  if (total === 0) {
    return { score: 0, correct: 0, partial: 0, miss: 0, total: 0, directionRate: 0 }
  }

  const values = answers.map((answer) => {
    const base = QUALITY_SCORE[answer.quality]
    const bonus = answer.hasWrittenPrediction ? PREDICTION.writtenBonus : 0
    return Math.min(PREDICTION.maxScore, base + bonus)
  })

  const count = (quality: PredictionQuality) =>
    answers.filter((answer) => answer.quality === quality).length

  const correct = count('correct')
  const partial = count('partial')

  return {
    score: Math.round(values.reduce((a, b) => a + b, 0) / total),
    correct,
    partial,
    miss: count('miss'),
    total,
    directionRate: (correct + partial) / total,
  }
}
