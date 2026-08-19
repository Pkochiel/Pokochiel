import type { ChunkLevel, LocalDate, PlanDuration } from './common'
import type { SkillId } from './skill'
import type { TrainingType } from './training'

export interface PlanBlock {
  order: number
  type: TrainingType
  minutes: number
  passageId?: string
  targetCpm?: number
  chunkLevel?: ChunkLevel
  /** この配分になった理由。AI Coach の説明文の元になる。 */
  reason?: string
}

export interface DailyTrainingPlan {
  id: string
  userId: string
  planDate: LocalDate
  totalMinutes: PlanDuration
  blocks: PlanBlock[]
  targetCpm: number | null
  chunkLevel: ChunkLevel | null
  generatedReason: PlanReason | null
  completedAt: string | null
  createdAt: string
}

export interface PlanReason {
  /** 弱い順に並べたスキル。構成の説明に使う。 */
  weakestSkills: SkillId[]
  /** まだ測っていないため、測定のために入れたトレーニング */
  measuredForFirstTime?: SkillId[]
  notes: string[]
}
