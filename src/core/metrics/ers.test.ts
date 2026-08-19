import { describe, expect, it } from 'vitest'
import { calculateErs, calculateRetainedErs } from './ers'

describe('calculateErs', () => {
  it('仕様の例と一致する（1500 × 0.8 × 0.7 = 840）', () => {
    expect(calculateErs({ cpm: 1500, comprehensionScore: 80, recallScore: 70 })).toBe(840)
  })

  it('理解度と想起が満点なら CPM と一致する', () => {
    expect(calculateErs({ cpm: 1200, comprehensionScore: 100, recallScore: 100 })).toBe(1200)
  })

  it('理解度が 0 なら 0 になる（速度だけでは点にならない）', () => {
    expect(calculateErs({ cpm: 3000, comprehensionScore: 0, recallScore: 100 })).toBe(0)
  })

  it('想起が 0 なら 0 になる', () => {
    expect(calculateErs({ cpm: 3000, comprehensionScore: 100, recallScore: 0 })).toBe(0)
  })

  it('速い読書より、遅くても理解と想起が伴う読書を高く評価する', () => {
    const fastShallow = calculateErs({ cpm: 2000, comprehensionScore: 40, recallScore: 25 })
    const slowDeep = calculateErs({ cpm: 700, comprehensionScore: 90, recallScore: 75 })
    expect(slowDeep).toBeGreaterThan(fastShallow ?? 0)
  })

  it.each([
    ['cpm', { cpm: null, comprehensionScore: 80, recallScore: 70 }],
    ['comprehension', { cpm: 1500, comprehensionScore: null, recallScore: 70 }],
    ['recall', { cpm: 1500, comprehensionScore: 80, recallScore: null }],
  ] as const)('%s が欠損なら null を返す（0 や 1 で埋めない）', (_label, input) => {
    expect(calculateErs(input)).toBeNull()
  })

  it('整数に丸める', () => {
    expect(calculateErs({ cpm: 1234, comprehensionScore: 75, recallScore: 25 })).toBe(231)
  })
})

describe('calculateRetainedErs', () => {
  it('翌日想起を使って算出する', () => {
    expect(
      calculateRetainedErs({ cpm: 1000, comprehensionScore: 80, delayedRecallScore: 50 }),
    ).toBe(400)
  })

  it('翌日想起が未実施なら null を返す', () => {
    expect(
      calculateRetainedErs({ cpm: 1000, comprehensionScore: 80, delayedRecallScore: null }),
    ).toBeNull()
  })
})
