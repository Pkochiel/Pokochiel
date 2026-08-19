import { READING } from '../config/training-config'

export interface CpmInput {
  /** 空白・改行を除いた本文文字数 */
  characterCount: number
  /** ポーズ時間と非表示時間を差し引いた実測秒 */
  elapsedSeconds: number
}

export type CpmInvalidReason = 'too_short' | 'implausible' | 'no_elapsed'

export interface CpmResult {
  cpm: number
  /** 統計・適応計算に使ってよい計測か */
  valid: boolean
  invalidReason: CpmInvalidReason | null
}

/**
 * CPM = 本文文字数 ÷ 読書秒数 × 60
 *
 * 誤タップやスキップで極端な値が入ると、以降の速度適応がすべて壊れる。
 * そのため、結果は保存しつつ valid=false を立てて統計から外す。
 */
export function calculateCpm({ characterCount, elapsedSeconds }: CpmInput): CpmResult {
  if (elapsedSeconds <= 0 || characterCount <= 0) {
    return { cpm: 0, valid: false, invalidReason: 'no_elapsed' }
  }

  const cpm = (characterCount / elapsedSeconds) * 60

  if (elapsedSeconds < READING.minReadingSeconds) {
    return { cpm, valid: false, invalidReason: 'too_short' }
  }
  if (cpm > READING.maxPlausibleCpm) {
    return { cpm, valid: false, invalidReason: 'implausible' }
  }
  return { cpm, valid: true, invalidReason: null }
}

/** 表示用に丸めた CPM。内部計算では丸めない。 */
export function formatCpm(cpm: number): number {
  return Math.round(cpm)
}

/** Baseline から最初の目標速度を決める（Baseline × 1.15）。 */
export function initialTargetCpm(baselineCpm: number): number {
  return Math.round(baselineCpm * READING.baselineStartMultiplier)
}
