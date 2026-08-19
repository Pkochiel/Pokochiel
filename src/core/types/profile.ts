import type { ChunkLevel, PlanDuration } from './common'

export interface Profile {
  id: string
  displayName: string | null
  baselineCpm: number | null
  targetCpm: number | null
  preferredDurationMinutes: PlanDuration
  chunkLevel: ChunkLevel
  timezone: string
  onboardedAt: string | null
  createdAt: string
  updatedAt: string
}
