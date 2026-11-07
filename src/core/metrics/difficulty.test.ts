import { describe, expect, it } from 'vitest'
import { DIFFICULTY_WEIGHTS } from '../config/training-config'
import { computeDifficultyScore, toDifficultyLevel } from './difficulty'
import type { DifficultyFactors } from '../types/passage'

const uniform = (value: 1 | 2 | 3 | 4 | 5): DifficultyFactors => ({
  vocabulary: value,
  sentenceLength: value,
  abstraction: value,
  informationDensity: value,
  logicalStructure: value,
  domainSpecificity: value,
})

describe('computeDifficultyScore', () => {
  it('重みの合計が 1 である', () => {
    const total = Object.values(DIFFICULTY_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('全要因が同じ値なら、その値をそのまま返す', () => {
    for (const value of [1, 2, 3, 4, 5] as const) {
      expect(computeDifficultyScore(uniform(value))).toBeCloseTo(value, 10)
    }
  })

  it('専門性だけが高い場合、全体は中間に留まる（単一要因で振り切らない）', () => {
    const score = computeDifficultyScore({ ...uniform(1), domainSpecificity: 5 })
    expect(score).toBeGreaterThan(1)
    expect(score).toBeLessThan(2)
  })
})

describe('toDifficultyLevel', () => {
  it('1〜5 に収まる', () => {
    for (const value of [1, 2, 3, 4, 5] as const) {
      expect(toDifficultyLevel(uniform(value))).toBe(value)
    }
  })

  it('端数を四捨五入する', () => {
    expect(toDifficultyLevel({ ...uniform(3), vocabulary: 4, abstraction: 4 })).toBe(3)
    expect(toDifficultyLevel({ ...uniform(4), vocabulary: 5, abstraction: 5 })).toBe(4)
  })
})
