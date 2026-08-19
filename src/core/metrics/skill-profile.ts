import { SCORING, SKILL } from '../config/training-config'
import type { ChunkLevel } from '../types/common'
import type { SkillId, SkillMeasurement, SkillProfile, SkillState } from '../types/skill'
import { SKILL_IDS } from '../types/skill'
import type { RecallTask, TrainingResult, TrainingType } from '../types/training'

export interface SkillProfileInput {
  results: readonly TrainingResult[]
  recallTasks: readonly RecallTask[]
  baselineCpm: number | null
}

/**
 * レベルの高さを加点する係数。
 * 同じ正答率でも、より難しいレベルで達成したほうが能力は高い。
 * レベル1でも 0 にはしない（正答している事実自体は能力の証拠）。
 */
function levelFactor(level: ChunkLevel | null): number {
  if (level === null) return SKILL.defaultLevelFactor
  return SKILL.minLevelFactor + (1 - SKILL.minLevelFactor) * ((level - 1) / 4)
}

function classify(score: number | null, sampleCount: number): SkillState {
  if (score === null || sampleCount < SKILL.minSamples) return 'unmeasured'
  if (score < SKILL.weakBelow) return 'weak'
  if (score >= SKILL.strongAtOrAbove) return 'strong'
  return 'normal'
}

/** 直近サンプルの前半と後半の差。傾向を1つの数値で表す。 */
function computeTrend(values: readonly number[]): number | null {
  if (values.length < SKILL.minSamplesForTrend) return null
  const half = Math.floor(values.length / 2)
  const earlier = values.slice(0, half)
  const later = values.slice(-half)
  const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.round(mean(later) - mean(earlier))
}

function measure(id: SkillId, values: readonly number[]): SkillMeasurement {
  const recent = values.slice(-SCORING.recentWindow)
  const score =
    recent.length === 0
      ? null
      : Math.round(Math.min(100, Math.max(0, recent.reduce((a, b) => a + b, 0) / recent.length)))
  return {
    id,
    score,
    state: classify(score, recent.length),
    sampleCount: recent.length,
    trend: computeTrend(values.slice(-SKILL.trendWindow)),
  }
}

function byCreatedAt<T extends { createdAt: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function pick(
  results: readonly TrainingResult[],
  types: readonly TrainingType[],
  read: (result: TrainingResult) => number | null,
): number[] {
  return byCreatedAt(results)
    .filter((r) => r.valid && types.includes(r.trainingType))
    .flatMap((r) => {
      const value = read(r)
      return value === null ? [] : [value]
    })
}

/**
 * 9つのスキルを独立に評価する。
 *
 * 未測定は score=null / state='unmeasured' とし、0 点として扱わない。
 * 「まだ測っていない」と「測ったうえで弱い」を混同すると、
 * トレーニング配分がまるごと誤った方向へ寄るため。
 */
export function computeSkillProfile(input: SkillProfileInput): SkillProfile {
  const { results, recallTasks, baselineCpm } = input

  const speedValues =
    baselineCpm === null || baselineCpm <= 0
      ? []
      : pick(results, ['speed_push', 'regression_control'], (r) =>
          r.cpm === null ? null : (r.cpm / (baselineCpm * SCORING.skillRadarSpeedCeiling)) * 100,
        )

  const measurements: SkillProfile = {
    reading_speed: measure('reading_speed', speedValues),

    chunk_recognition: measure(
      'chunk_recognition',
      pick(results, ['chunk_reading'], (r) =>
        r.comprehensionScore === null ? null : r.comprehensionScore * levelFactor(r.level),
      ),
    ),

    meaning_extraction: measure(
      'meaning_extraction',
      pick(results, ['meaning_flash'], (r) =>
        r.accuracyScore === null ? null : r.accuracyScore * levelFactor(r.level),
      ),
    ),

    structure_recognition: measure(
      'structure_recognition',
      pick(results, ['structure_reading'], (r) => r.comprehensionScore),
    ),

    prediction: measure(
      'prediction',
      pick(results, ['prediction_reading'], (r) => r.accuracyScore),
    ),

    adaptive_reading: measure(
      'adaptive_reading',
      pick(results, ['variable_speed'], (r) => r.accuracyScore),
    ),

    comprehension: measure(
      'comprehension',
      pick(results, ['comprehension', 'speed_push'], (r) => r.comprehensionScore),
    ),

    immediate_recall: measure(
      'immediate_recall',
      pick(results, ['immediate_recall'], (r) => r.immediateRecallScore),
    ),

    delayed_recall: measure(
      'delayed_recall',
      byCreatedAt(recallTasks.filter((t) => t.status === 'completed')).flatMap((t) =>
        t.recallScore === null ? [] : [t.recallScore],
      ),
    ),
  }

  return measurements
}

/** 表示・集計用に、測定済みのスキルだけを返す。 */
export function measuredSkills(profile: SkillProfile): SkillMeasurement[] {
  return SKILL_IDS.map((id) => profile[id]).filter((m) => m.state !== 'unmeasured')
}

/**
 * 弱い順に並べる。未測定は「弱い」とは違うので、weak の後・normal の前に置く
 * （測ること自体に価値があるが、既知の弱点の解消を優先する）。
 */
const STATE_PRIORITY: Record<SkillState, number> = {
  weak: 0,
  unmeasured: 1,
  normal: 2,
  strong: 3,
}

export function rankSkillsByNeed(profile: SkillProfile): SkillMeasurement[] {
  return SKILL_IDS.map((id) => profile[id]).sort((a, b) => {
    const byState = STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state]
    if (byState !== 0) return byState
    const scoreA = a.score ?? SCORING.neutralScore
    const scoreB = b.score ?? SCORING.neutralScore
    if (scoreA !== scoreB) return scoreA - scoreB
    return SKILL_IDS.indexOf(a.id) - SKILL_IDS.indexOf(b.id)
  })
}
