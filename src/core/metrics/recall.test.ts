import { describe, expect, it } from 'vitest'
import { RECALL, SCORING } from '../config/training-config'
import { combineRecallScores, normalizeRecallScore } from './recall'

describe('normalizeRecallScore', () => {
  it('許可された段階はそのまま返す', () => {
    for (const step of RECALL.selfAssessmentSteps) {
      expect(normalizeRecallScore(step)).toBe(step)
    }
  })

  it('中間の値を最も近い段階に丸める', () => {
    expect(normalizeRecallScore(30)).toBe(25)
    expect(normalizeRecallScore(60)).toBe(50)
    expect(normalizeRecallScore(70)).toBe(75)
  })

  it('範囲外の値を端に寄せる', () => {
    expect(normalizeRecallScore(-20)).toBe(0)
    expect(normalizeRecallScore(200)).toBe(100)
  })
})

describe('combineRecallScores', () => {
  it('両方あれば翌日想起に重みを置いて合成する', () => {
    const result = combineRecallScores({ immediate: 100, delayed: 0 })
    expect(result).toBe(Math.round(100 * (1 - SCORING.delayedRecallWeight)))
  })

  it('翌日想起のほうが結果への影響が大きい', () => {
    const byDelayed = combineRecallScores({ immediate: 0, delayed: 100 })
    const byImmediate = combineRecallScores({ immediate: 100, delayed: 0 })
    expect(byDelayed).toBeGreaterThan(byImmediate ?? 0)
  })

  it('翌日想起がまだ無ければ直後想起を使う', () => {
    expect(combineRecallScores({ immediate: 75, delayed: null })).toBe(75)
  })

  it('直後想起が無ければ翌日想起を使う', () => {
    expect(combineRecallScores({ immediate: null, delayed: 50 })).toBe(50)
  })

  it('どちらも無ければ null を返す', () => {
    expect(combineRecallScores({ immediate: null, delayed: null })).toBeNull()
  })

  it('0 を欠損として扱わない', () => {
    expect(combineRecallScores({ immediate: 0, delayed: 0 })).toBe(0)
  })
})
