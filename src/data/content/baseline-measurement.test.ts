import { describe, expect, it } from 'vitest'
import { calculateCpm, minimumValidSeconds } from '@/core/metrics/cpm'
import { BASELINE_POOL } from './index'

/**
 * Baseline の測定方針が、教材の分量と噛み合っているかを固定する。
 *
 * 教材を差し替えたときに「普通に読んだのに無効になる」「飛ばし読みが有効になる」
 * のどちらへも倒れないよう、両側から挟んで検証する（docs/METRICS.md）。
 */
describe('Baseline 測定の妥当性', () => {
  const TYPICAL_CPM = 600
  const TRAINED_CPM = 1500

  it.each(BASELINE_POOL.map((passage) => [passage.id, passage] as const))(
    '%s の最短有効時間は 15〜45 秒に収まる',
    (_id, passage) => {
      const floor = minimumValidSeconds(passage.characterCount)
      expect(floor).toBeGreaterThanOrEqual(15)
      expect(floor).toBeLessThanOrEqual(45)
    },
  )

  it.each(BASELINE_POOL.map((passage) => [passage.id, passage] as const))(
    '%s は一般的な速度で読めば必ず有効になる',
    (_id, passage) => {
      const elapsedSeconds = (passage.characterCount / TYPICAL_CPM) * 60
      expect(calculateCpm({ characterCount: passage.characterCount, elapsedSeconds }).valid).toBe(
        true,
      )
      // 一般的な速度での所要時間は、下限の 3 倍以上の余裕がある
      expect(elapsedSeconds).toBeGreaterThan(minimumValidSeconds(passage.characterCount) * 3)
    },
  )

  it.each(BASELINE_POOL.map((passage) => [passage.id, passage] as const))(
    '%s は訓練者の速度でも無効にしない',
    (_id, passage) => {
      const elapsedSeconds = (passage.characterCount / TRAINED_CPM) * 60
      expect(calculateCpm({ characterCount: passage.characterCount, elapsedSeconds }).valid).toBe(
        true,
      )
    },
  )

  it.each(BASELINE_POOL.map((passage) => [passage.id, passage] as const))(
    '%s は 10 秒で読み終えた申告を無効にする',
    (_id, passage) => {
      const result = calculateCpm({ characterCount: passage.characterCount, elapsedSeconds: 10 })
      expect(result.valid).toBe(false)
      expect(result.invalidReason).toBe('implausible')
    },
  )

  it('教材のローテーションに足る本数がある', () => {
    expect(BASELINE_POOL.length).toBeGreaterThanOrEqual(3)
    expect(new Set(BASELINE_POOL.map((p) => p.id)).size).toBe(BASELINE_POOL.length)
  })
})
