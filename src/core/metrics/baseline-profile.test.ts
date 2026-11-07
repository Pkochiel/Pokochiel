import { describe, expect, it } from 'vitest'
import { makeReadingTest } from '../__tests__/fixtures'
import { computeBaselineProfile, median, validBaselineTests } from './baseline-profile'

describe('median', () => {
  it('奇数個なら中央の値を返す', () => {
    expect(median([500, 600, 700])).toBe(600)
  })

  it('偶数個なら中央2つの平均を返す', () => {
    expect(median([500, 600, 700, 800])).toBe(650)
  })

  it('順序が乱れていても正しい', () => {
    expect(median([700, 500, 600])).toBe(600)
  })

  it('空なら null', () => {
    expect(median([])).toBeNull()
  })
})

describe('computeBaselineProfile', () => {
  it('測定がなければ全項目 null、attempts は 0', () => {
    const profile = computeBaselineProfile([])
    expect(profile.cpm).toBeNull()
    expect(profile.comprehension).toBeNull()
    expect(profile.attempts).toBe(0)
    expect(profile.updatedAt).toBeNull()
  })

  it('CPM は中央値を採る（1回の偶然で基準が動かない）', () => {
    const profile = computeBaselineProfile([
      makeReadingTest({ cpm: 500, elapsedSeconds: 168, createdAt: '2026-08-10T09:00:00Z' }),
      makeReadingTest({ cpm: 560, elapsedSeconds: 150, createdAt: '2026-08-12T09:00:00Z' }),
      // 極端に速い1回
      makeReadingTest({ cpm: 2400, elapsedSeconds: 35, createdAt: '2026-08-14T09:00:00Z' }),
    ])
    expect(profile.cpm).toBe(560)
    expect(profile.attempts).toBe(3)
  })

  it('平均だと外れ値に引きずられることを確認する（中央値が優れる理由）', () => {
    const values = [500, 560, 2400]
    const average = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    expect(average).toBeGreaterThan(1000)
    expect(
      computeBaselineProfile([
        makeReadingTest({ cpm: 500, createdAt: '2026-08-10T09:00:00Z' }),
        makeReadingTest({ cpm: 560, createdAt: '2026-08-12T09:00:00Z' }),
        makeReadingTest({ cpm: 2400, createdAt: '2026-08-14T09:00:00Z' }),
      ]).cpm,
    ).toBe(560)
  })

  it('無効な測定（短すぎる）を除外する', () => {
    const profile = computeBaselineProfile([
      makeReadingTest({ cpm: 560, elapsedSeconds: 150, createdAt: '2026-08-10T09:00:00Z' }),
      makeReadingTest({ cpm: 90000, elapsedSeconds: 1, createdAt: '2026-08-11T09:00:00Z' }),
    ])
    expect(profile.attempts).toBe(1)
    expect(profile.cpm).toBe(560)
  })

  it('Baseline 以外の測定を含めない', () => {
    const profile = computeBaselineProfile([
      makeReadingTest({ isBaseline: false, cpm: 900 }),
      makeReadingTest({ isBaseline: true, cpm: 500 }),
    ])
    expect(profile.attempts).toBe(1)
    expect(profile.cpm).toBe(500)
  })

  it('理解の内訳を設問タイプ別に保持する', () => {
    const profile = computeBaselineProfile([
      makeReadingTest({
        comprehensionScore: 75,
        typeScores: { main_idea: 100, cause_effect: 50, structure: 50 },
        createdAt: '2026-08-10T09:00:00Z',
      }),
      makeReadingTest({
        comprehensionScore: 85,
        typeScores: { main_idea: 100, cause_effect: 100, structure: 50 },
        createdAt: '2026-08-12T09:00:00Z',
      }),
    ])
    expect(profile.comprehension).toBe(80)
    expect(profile.mainIdea).toBe(100)
    expect(profile.causeEffect).toBe(75)
    expect(profile.structure).toBe(50)
  })

  it('内訳が記録されていない測定でも落ちない', () => {
    const profile = computeBaselineProfile([makeReadingTest({ typeScores: null })])
    expect(profile.mainIdea).toBeNull()
    expect(profile.comprehension).not.toBeNull()
  })

  it('想起も Baseline Profile に含める', () => {
    const profile = computeBaselineProfile([
      makeReadingTest({ recallScore: 60, createdAt: '2026-08-10T09:00:00Z' }),
      makeReadingTest({ recallScore: 80, createdAt: '2026-08-12T09:00:00Z' }),
    ])
    expect(profile.immediateRecall).toBe(70)
  })

  it('最新の測定日時を保持する', () => {
    const profile = computeBaselineProfile([
      makeReadingTest({ createdAt: '2026-08-10T09:00:00Z' }),
      makeReadingTest({ createdAt: '2026-08-14T09:00:00Z' }),
      makeReadingTest({ createdAt: '2026-08-12T09:00:00Z' }),
    ])
    expect(profile.updatedAt).toBe('2026-08-14T09:00:00Z')
  })

  it('2回目以降の測定でも同じ形で集計できる（再測定に対応する）', () => {
    const first = computeBaselineProfile([makeReadingTest({ cpm: 500 })])
    const second = computeBaselineProfile([
      makeReadingTest({ cpm: 500, createdAt: '2026-08-10T09:00:00Z' }),
      makeReadingTest({ cpm: 700, createdAt: '2026-08-20T09:00:00Z' }),
    ])
    expect(first.attempts).toBe(1)
    expect(second.attempts).toBe(2)
    expect(second.cpm).toBe(600)
  })
})

describe('validBaselineTests', () => {
  it('有効な測定だけを返す', () => {
    const tests = [
      makeReadingTest({ elapsedSeconds: 150, characterCount: 1400 }),
      makeReadingTest({ elapsedSeconds: 1, characterCount: 1400 }),
    ]
    expect(validBaselineTests(tests)).toHaveLength(1)
  })
})
