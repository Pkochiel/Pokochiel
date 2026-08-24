import { describe, expect, it } from 'vitest'
import { READING } from '../config/training-config'
import { calculateCpm, formatCpm, initialTargetCpm } from './cpm'

describe('calculateCpm', () => {
  it('文字数 ÷ 秒数 × 60 を返す', () => {
    expect(calculateCpm({ characterCount: 600, elapsedSeconds: 60 }).cpm).toBeCloseTo(600, 6)
    expect(calculateCpm({ characterCount: 900, elapsedSeconds: 60 }).cpm).toBeCloseTo(900, 6)
    expect(calculateCpm({ characterCount: 500, elapsedSeconds: 30 }).cpm).toBeCloseTo(1000, 6)
  })

  it('通常の計測は valid になる', () => {
    const result = calculateCpm({ characterCount: 888, elapsedSeconds: 90 })
    expect(result.valid).toBe(true)
    expect(result.invalidReason).toBeNull()
    expect(Math.round(result.cpm)).toBe(592)
  })

  it('最低秒数を下回る計測は invalid にする', () => {
    const result = calculateCpm({
      characterCount: 400,
      elapsedSeconds: READING.minReadingSeconds - 0.1,
    })
    expect(result.valid).toBe(false)
    expect(result.invalidReason).toBe('too_short')
    // 値そのものは記録として残す
    expect(result.cpm).toBeGreaterThan(0)
  })

  it('最低秒数ちょうどは valid とする', () => {
    const result = calculateCpm({ characterCount: 100, elapsedSeconds: READING.minReadingSeconds })
    expect(result.valid).toBe(true)
  })

  it('現実的でない速度は invalid にする', () => {
    const result = calculateCpm({ characterCount: 100000, elapsedSeconds: 60 })
    expect(result.valid).toBe(false)
    expect(result.invalidReason).toBe('implausible')
  })

  it('上限ちょうどは valid とする', () => {
    const result = calculateCpm({
      characterCount: READING.maxPlausibleCpm,
      elapsedSeconds: 60,
    })
    expect(result.cpm).toBeCloseTo(READING.maxPlausibleCpm, 6)
    expect(result.valid).toBe(true)
  })

  it('経過時間が 0 以下なら 0 を返し invalid にする（ゼロ除算を起こさない）', () => {
    for (const elapsedSeconds of [0, -1]) {
      const result = calculateCpm({ characterCount: 500, elapsedSeconds })
      expect(result.cpm).toBe(0)
      expect(result.valid).toBe(false)
      expect(result.invalidReason).toBe('no_elapsed')
    }
  })

  it('文字数が 0 以下なら invalid にする', () => {
    expect(calculateCpm({ characterCount: 0, elapsedSeconds: 60 }).valid).toBe(false)
  })
})

describe('formatCpm', () => {
  it('整数に丸める', () => {
    expect(formatCpm(592.4)).toBe(592)
    expect(formatCpm(592.5)).toBe(593)
  })
})

describe('initialTargetCpm', () => {
  it('Baseline の 1.15 倍から始める', () => {
    expect(initialTargetCpm(600)).toBe(690)
    expect(initialTargetCpm(1000)).toBe(1150)
  })

  it('設定値に追従する（マジックナンバーを持たない）', () => {
    expect(initialTargetCpm(800)).toBe(Math.round(800 * READING.baselineStartMultiplier))
  })
})
