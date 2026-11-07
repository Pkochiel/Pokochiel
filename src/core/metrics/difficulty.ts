import { DIFFICULTY_WEIGHTS } from '../config/training-config'
import type { Difficulty } from '../types/common'
import type { DifficultyFactors } from '../types/passage'

/**
 * 難易度は文字数だけで決めない。語彙・文長・抽象度・情報密度・論理構造・専門性の
 * 加重和で算出する（docs/DATA_MODEL.md §4）。
 */
export function computeDifficultyScore(factors: DifficultyFactors): number {
  return (
    factors.vocabulary * DIFFICULTY_WEIGHTS.vocabulary +
    factors.sentenceLength * DIFFICULTY_WEIGHTS.sentenceLength +
    factors.abstraction * DIFFICULTY_WEIGHTS.abstraction +
    factors.informationDensity * DIFFICULTY_WEIGHTS.informationDensity +
    factors.logicalStructure * DIFFICULTY_WEIGHTS.logicalStructure +
    factors.domainSpecificity * DIFFICULTY_WEIGHTS.domainSpecificity
  )
}

/** 加重和を 1–5 の難易度に丸める。 */
export function toDifficultyLevel(factors: DifficultyFactors): Difficulty {
  const rounded = Math.round(computeDifficultyScore(factors))
  return Math.min(5, Math.max(1, rounded)) as Difficulty
}
