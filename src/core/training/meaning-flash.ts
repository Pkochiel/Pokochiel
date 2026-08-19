import { MEANING_FLASH } from '../config/training-config'
import type { ChunkLevel } from '../types/common'

/**
 * Meaning Flash の進行。
 *
 * 鍛えるのは「短い露出から意味を取り出す速度」であり、文字列の記憶ではない。
 * そのため表示時間はレベルで決め、設問は語句ではなく意味を問う。
 * 表示時間には下限を設け、極端なフラッシュ表示は行わない。
 */
export function exposureMsFor(level: ChunkLevel): number {
  const configured = MEANING_FLASH.exposureMsByLevel[level]
  return Math.max(MEANING_FLASH.minExposureMs, configured)
}

export interface MeaningFlashScore {
  /** 0–100 */
  score: number
  correct: number
  total: number
  accuracy: number
}

export function scoreMeaningFlash(results: readonly boolean[]): MeaningFlashScore {
  const total = results.length
  const correct = results.filter(Boolean).length
  const accuracy = total === 0 ? 0 : correct / total
  return { score: Math.round(accuracy * 100), correct, total, accuracy }
}

/**
 * レベルの昇降。
 * 正答率が高ければ表示時間を短くし、落ちれば戻す。
 * 速さそのものではなく「速くしても意味が取れるか」を上げていく。
 */
export function adaptMeaningFlashLevel(current: ChunkLevel, accuracy: number): ChunkLevel {
  if (accuracy >= MEANING_FLASH.levelUpAccuracy) return Math.min(5, current + 1) as ChunkLevel
  if (accuracy < MEANING_FLASH.levelDownAccuracy) return Math.max(1, current - 1) as ChunkLevel
  return current
}
