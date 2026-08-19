import type { ChunkLevel, PlanDuration } from './common'

/**
 * Baseline の測定結果。速度だけでなく、理解の内訳と想起まで含めて現在地とする。
 * 複数回測定した場合、CPM は中央値を採る（1回の偶然で基準が動かないようにする）。
 */
export interface BaselineProfile {
  /** 有効な測定の中央値 */
  cpm: number | null
  comprehension: number | null
  mainIdea: number | null
  causeEffect: number | null
  structure: number | null
  immediateRecall: number | null
  /** 有効だった測定回数 */
  attempts: number
  /** 直近の測定日時 */
  updatedAt: string | null
}

export interface Profile {
  id: string
  displayName: string | null
  baselineCpm: number | null
  targetCpm: number | null
  preferredDurationMinutes: PlanDuration
  chunkLevel: ChunkLevel
  /** Meaning Flash のレベル。表示時間を決める。 */
  meaningFlashLevel: ChunkLevel
  timezone: string
  onboardedAt: string | null
  /**
   * Baseline の詳細。旧データには存在しないため null を許す
   * （その場合は baselineCpm のみで動作する）。
   */
  baselineProfile: BaselineProfile | null
  /** Baseline で使用済みの教材。再測定で同じ文章を出さないために保持する。 */
  usedBaselinePassageIds: string[]
  createdAt: string
  updatedAt: string
}
