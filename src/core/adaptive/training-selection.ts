import { CORE_TRAINING_SKILLS, OPTIONAL_TRAINING_SKILLS, SKILL } from '../config/training-config'
import { hashString } from '../util/seeded-shuffle'
import type { SkillId, SkillProfile, SkillState } from '../types/skill'
import type { TrainingType } from '../types/training'

export type OptionalTraining = keyof typeof OPTIONAL_TRAINING_SKILLS
export type CoreTraining = keyof typeof CORE_TRAINING_SKILLS

export const OPTIONAL_TRAININGS = Object.keys(OPTIONAL_TRAINING_SKILLS) as OptionalTraining[]

/**
 * 状態の優先度。
 * 既知の弱点を最優先し、その次に「まだ測っていない」を置く。
 * 未測定を放置すると Skill Profile が埋まらず、以降の配分判断ができなくなるため。
 */
const STATE_PRIORITY: Record<SkillState, number> = {
  weak: 0,
  unmeasured: 1,
  normal: 2,
  strong: 3,
}

export interface SelectionInput {
  profile: SkillProfile
  /** その日に実施可能なトレーニング（教材が用意できるものだけ） */
  available: readonly OptionalTraining[]
  /** 同順位のときの並びを日ごとに回すための種（通常は日付） */
  rotationSeed: string
  /** 選ぶ最大数 */
  limit: number
}

export interface SelectedTraining {
  type: OptionalTraining
  skill: SkillId
  state: SkillState
  reason: string
}

const STATE_REASONS: Record<SkillState, string> = {
  weak: '弱点として検出されたため',
  unmeasured: 'まだ測定できていないため',
  normal: 'バランスを保つため',
  strong: '維持のため',
}

/**
 * 任意ブロックを選ぶ。
 *
 * 同じ優先度の中では日付由来の回転を使い、同じ内容が毎日続かないようにする。
 * 同じ日付・同じ Profile なら常に同じ結果になる（決定的）。
 */
export function selectOptionalTrainings(input: SelectionInput): SelectedTraining[] {
  const { profile, available, rotationSeed, limit } = input
  if (limit <= 0) return []

  const offset = hashString(rotationSeed) % Math.max(1, available.length)
  const rotated = available.map((_, i) => available[(i + offset) % available.length]!)

  return rotated
    .map((type, index) => {
      const skill = OPTIONAL_TRAINING_SKILLS[type]
      const measurement = profile[skill]
      return {
        type,
        skill,
        state: measurement.state,
        score: measurement.score,
        order: index,
        reason: `${STATE_REASONS[measurement.state]}`,
      }
    })
    .sort((a, b) => {
      const byState = STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state]
      if (byState !== 0) return byState
      const scoreA = a.score ?? 50
      const scoreB = b.score ?? 50
      if (scoreA !== scoreB) return scoreA - scoreB
      return a.order - b.order
    })
    .slice(0, limit)
    .map(({ type, skill, state, reason }) => ({ type, skill, state, reason }))
}

export interface CoreEmphasis {
  /** コア側で時間を増やすトレーニング */
  emphasize: TrainingType[]
  /** 時間を増やしてはいけないトレーニング */
  suppress: TrainingType[]
  notes: string[]
}

const isWeak = (state: SkillState) => state === 'weak'
const isStrong = (state: SkillState) => state === 'strong'

/**
 * コアブロックの重み付け。
 *
 * 方針として明示しておくこと：
 * - 速度を上げることを常に成功とみなさない
 * - 理解が伴っていないのに Speed Push を増やさない
 * - 想起が弱いときは速度を落とすのではなく、Recall と構造把握を増やす
 */
export function assessCoreEmphasis(profile: SkillProfile): CoreEmphasis {
  const emphasize: TrainingType[] = []
  const suppress: TrainingType[] = []
  const notes: string[] = []

  const speed = profile.reading_speed
  const comprehension = profile.comprehension

  if (isWeak(speed.state) && (isStrong(comprehension.state) || comprehension.state === 'normal')) {
    emphasize.push('speed_push')
    notes.push('理解を保てているので、速度を伸ばす時間を増やします')
  }

  if (isStrong(speed.state) && isWeak(comprehension.state)) {
    suppress.push('speed_push')
    emphasize.push('structure_reading', 'comprehension')
    notes.push('速度は出ていますが理解が追いついていないため、速度は増やさず構造把握を増やします')
  }

  if (isWeak(profile.structure_recognition.state)) {
    emphasize.push('structure_reading')
    notes.push('段落の役割を掴む力が弱いため、Structure Reading を増やします')
  }

  if (isWeak(comprehension.state) && !suppress.includes('speed_push')) {
    emphasize.push('comprehension')
    notes.push('理解度が目標を下回っているため、理解度テストの時間を増やします')
  }

  if (isWeak(profile.immediate_recall.state) || isWeak(profile.delayed_recall.state)) {
    emphasize.push('immediate_recall', 'structure_reading')
    suppress.push('speed_push')
    notes.push('想起が弱いため、速度を上げるのではなく Recall と構造把握を増やします')
  }

  const dedupe = <T>(values: T[]) => [...new Set(values)]
  const suppressed = dedupe(suppress)

  return {
    emphasize: dedupe(emphasize).filter((type) => !suppressed.includes(type)),
    suppress: suppressed,
    notes,
  }
}

/** 未測定のスキル（測定のために組み込む価値があるもの）。 */
export function unmeasuredSkills(profile: SkillProfile): SkillId[] {
  return (Object.keys(profile) as SkillId[]).filter(
    (id) => profile[id].state === 'unmeasured' || profile[id].sampleCount < SKILL.minSamples,
  )
}
