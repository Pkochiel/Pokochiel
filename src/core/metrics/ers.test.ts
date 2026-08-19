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

describe('ERS の限界（唯一の総合指標にしないための確認）', () => {
  it('ERS は CPM に対して線形に伸びる', () => {
    const base = calculateErs({ cpm: 600, comprehensionScore: 80, recallScore: 70 })
    const doubled = calculateErs({ cpm: 1200, comprehensionScore: 80, recallScore: 70 })
    expect(doubled).toBe((base ?? 0) * 2)
  })

  it('極端な CPM は ERS を極端に押し上げる（上限がない）', () => {
    const realistic = calculateErs({ cpm: 700, comprehensionScore: 85, recallScore: 75 })
    const extreme = calculateErs({ cpm: 5000, comprehensionScore: 85, recallScore: 75 })
    expect(extreme).toBeGreaterThan((realistic ?? 0) * 5)
  })

  it('理解と想起が中程度でも、CPM が大きければ深く読んだ場合を上回る', () => {
    const fastShallow = calculateErs({ cpm: 4000, comprehensionScore: 60, recallScore: 50 })
    const slowDeep = calculateErs({ cpm: 700, comprehensionScore: 100, recallScore: 100 })
    // これは ERS の設計上の性質であり、Skill Profile を主要指標に置く理由でもある
    expect(fastShallow).toBeGreaterThan(slowDeep ?? 0)
  })

  it('理解または想起が 0 なら、CPM がいくら高くても 0 になる', () => {
    expect(calculateErs({ cpm: 9999, comprehensionScore: 0, recallScore: 100 })).toBe(0)
    expect(calculateErs({ cpm: 9999, comprehensionScore: 100, recallScore: 0 })).toBe(0)
  })

  it('無効な計測は ERS に到達しない（呼び出し側が null を渡す前提）', () => {
    expect(calculateErs({ cpm: null, comprehensionScore: 100, recallScore: 100 })).toBeNull()
  })
})
