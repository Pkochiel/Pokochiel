import { SCORING } from '../config/training-config'
import type { SkillAxis, SkillRadar } from '../types/plan'
import type { RecallTask, TrainingResult } from '../types/training'
import { combineRecallScores } from './recall'

export interface SkillRadarInput {
  results: readonly TrainingResult[]
  recallTasks: readonly RecallTask[]
  baselineCpm: number | null
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function recentMean(values: readonly number[]): number | null {
  const recent = values.slice(-SCORING.recentWindow)
  if (recent.length < SCORING.minSamplesPerAxis) return null
  return recent.reduce((sum, v) => sum + v, 0) / recent.length
}

function ofType(
  results: readonly TrainingResult[],
  ...types: readonly TrainingResult['trainingType'][]
): TrainingResult[] {
  return results.filter((r) => r.valid && types.includes(r.trainingType))
}

export interface SkillRadarResult {
  scores: SkillRadar
  /**
   * 実測に足るサンプルがあった軸。
   * 未実測の軸を「弱点」と解釈しないために、スコアと分けて持つ。
   */
  measured: Record<SkillAxis, boolean>
}

/**
 * 6軸の能力を 0–100 に正規化する。
 *
 * サンプルが足りない軸は中央値（50）として扱い、measured を false にする。
 * 0 と混同すると「まだ測っていない」ことが「弱点」と誤解され、配分が偏るため。
 */
export function computeSkillRadar({
  results,
  recallTasks,
  baselineCpm,
}: SkillRadarInput): SkillRadarResult {
  const neutral = SCORING.neutralScore

  const cpmValues = ofType(results, 'speed_push', 'warmup').flatMap((r) =>
    r.cpm === null ? [] : [r.cpm],
  )
  const meanCpm = recentMean(cpmValues)
  const readingSpeed =
    meanCpm === null || baselineCpm === null || baselineCpm <= 0
      ? neutral
      : clamp01(meanCpm / (baselineCpm * SCORING.skillRadarSpeedCeiling)) * 100

  const chunkResults = ofType(results, 'chunk_reading')
  const chunkValues = chunkResults.flatMap((r) =>
    r.comprehensionScore === null ? [] : [r.comprehensionScore * ((r.chunkLevel ?? 1) / 5)],
  )
  const chunking = recentMean(chunkValues) ?? neutral

  const structure =
    recentMean(
      ofType(results, 'structure_reading').flatMap((r) =>
        r.comprehensionScore === null ? [] : [r.comprehensionScore],
      ),
    ) ?? neutral

  const comprehension =
    recentMean(
      ofType(results, 'comprehension', 'speed_push').flatMap((r) =>
        r.comprehensionScore === null ? [] : [r.comprehensionScore],
      ),
    ) ?? neutral

  const immediate = recentMean(
    ofType(results, 'immediate_recall').flatMap((r) =>
      r.immediateRecallScore === null ? [] : [r.immediateRecallScore],
    ),
  )
  const delayed = recentMean(
    recallTasks
      .filter((t) => t.status === 'completed')
      .flatMap((t) => (t.recallScore === null ? [] : [t.recallScore])),
  )
  const recall = combineRecallScores({ immediate, delayed }) ?? neutral

  const adaptiveReading =
    recentMean(
      ofType(results, 'variable_speed').flatMap((r) =>
        r.comprehensionScore === null ? [] : [r.comprehensionScore],
      ),
    ) ?? neutral

  return {
    scores: {
      reading_speed: Math.round(readingSpeed),
      chunking: Math.round(chunking),
      structure: Math.round(structure),
      comprehension: Math.round(comprehension),
      recall: Math.round(recall),
      adaptive_reading: Math.round(adaptiveReading),
    },
    measured: {
      reading_speed: meanCpm !== null && baselineCpm !== null && baselineCpm > 0,
      chunking: recentMean(chunkValues) !== null,
      structure:
        recentMean(
          ofType(results, 'structure_reading').flatMap((r) =>
            r.comprehensionScore === null ? [] : [r.comprehensionScore],
          ),
        ) !== null,
      comprehension:
        recentMean(
          ofType(results, 'comprehension', 'speed_push').flatMap((r) =>
            r.comprehensionScore === null ? [] : [r.comprehensionScore],
          ),
        ) !== null,
      recall: immediate !== null || delayed !== null,
      adaptive_reading:
        recentMean(
          ofType(results, 'variable_speed').flatMap((r) =>
            r.comprehensionScore === null ? [] : [r.comprehensionScore],
          ),
        ) !== null,
    },
  }
}

export const SKILL_AXES: readonly SkillAxis[] = [
  'reading_speed',
  'chunking',
  'structure',
  'comprehension',
  'recall',
  'adaptive_reading',
]

export const SKILL_AXIS_LABELS: Record<SkillAxis, string> = {
  reading_speed: 'Reading Speed',
  chunking: 'Chunking',
  structure: 'Structure',
  comprehension: 'Comprehension',
  recall: 'Recall',
  adaptive_reading: 'Adaptive Reading',
}
