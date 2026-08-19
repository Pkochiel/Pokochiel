import { describe, expect, it } from 'vitest'
import { REGRESSION } from '../config/training-config'
import { backPerKiloChars, evaluateRegression, type RegressionInput } from './regression'

const input = (overrides: Partial<RegressionInput> = {}): RegressionInput => ({
  backCount: 4,
  pauseCount: 1,
  characterCount: 1000,
  comprehensionScore: 80,
  previousBackPerKiloChars: 6,
  previousComprehension: 80,
  ...overrides,
})

describe('backPerKiloChars', () => {
  it('1000字あたりの回数に換算する', () => {
    expect(backPerKiloChars(5, 1000)).toBe(5)
    expect(backPerKiloChars(5, 500)).toBe(10)
  })

  it('文字数が 0 でもゼロ除算しない', () => {
    expect(backPerKiloChars(5, 0)).toBe(0)
  })
})

describe('evaluateRegression', () => {
  it('読み戻りが減り、理解度が保てていれば改善と判断する', () => {
    const result = evaluateRegression(input({ backCount: 2, comprehensionScore: 80 }))
    expect(result.verdict).toBe('improved')
  })

  it('読み戻りが減っても理解度が大きく落ちていれば速度過剰と判断する', () => {
    const result = evaluateRegression(
      input({
        backCount: 1,
        comprehensionScore: 80 - REGRESSION.comprehensionDropThreshold,
      }),
    )
    expect(result.verdict).toBe('too_fast')
    expect(result.message).toContain('取りこぼした')
  })

  it('読み戻りの少なさだけでは良いと判断しない', () => {
    const fewBacksLowComprehension = evaluateRegression(
      input({ backCount: 0, comprehensionScore: 40 }),
    )
    expect(fewBacksLowComprehension.verdict).not.toBe('improved')
  })

  it('読み戻りが増えても理解度が保てていれば維持と判断する', () => {
    const result = evaluateRegression(
      input({ backCount: 7, previousBackPerKiloChars: 6, comprehensionScore: 85 }),
    )
    expect(result.verdict).toBe('maintained')
  })

  it('読み戻りが多すぎる場合は指摘する', () => {
    const result = evaluateRegression(
      input({
        backCount: REGRESSION.highBackPerKiloChars + 5,
        previousBackPerKiloChars: 1,
        comprehensionScore: 85,
      }),
    )
    expect(result.verdict).toBe('needs_more_control')
  })

  it('比較対象がなければ判断しない', () => {
    expect(
      evaluateRegression(input({ previousBackPerKiloChars: null })).verdict,
    ).toBe('insufficient_data')
    expect(evaluateRegression(input({ previousComprehension: null })).verdict).toBe(
      'insufficient_data',
    )
  })

  it('読み戻りの密度を返す', () => {
    expect(evaluateRegression(input({ backCount: 3, characterCount: 1500 })).backPerKiloChars).toBe(2)
  })

  it('判定ごとに説明が返る', () => {
    for (const verdict of ['improved', 'too_fast', 'needs_more_control'] as const) {
      const result = evaluateRegression(
        verdict === 'improved'
          ? input({ backCount: 1 })
          : verdict === 'too_fast'
            ? input({ backCount: 1, comprehensionScore: 50 })
            : input({ backCount: 20, previousBackPerKiloChars: 1 }),
      )
      expect(result.message.length).toBeGreaterThan(0)
    }
  })
})
