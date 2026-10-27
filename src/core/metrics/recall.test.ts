import { describe, expect, it } from 'vitest'
import { RECALL, SCORING } from '../config/training-config'
import {
  combineRecallScores,
  evaluateRecall,
  normalizeRecallScore,
  type RecallEvaluator,
} from './recall'

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

describe('evaluateRecall: Key Point の照合', () => {
  const keyPoints = ['DX投資は増えている', '成果企業は限定的', '組織の縦割りが要因', '全社最適が必要']

  it('思い出せた Key Point の割合を主要値にする', () => {
    const result = evaluateRecall({
      keyPoints,
      recalledKeyPointIndexes: [0, 2],
      selfAssessment: 100,
      text: '書いた内容',
    })
    expect(result.score).toBe(50)
    expect(result.method).toBe('key_points')
    expect(result.recalledCount).toBe(2)
    expect(result.totalCount).toBe(4)
  })

  it('自己評価は主要値を上書きしない（補助指標に留める）', () => {
    const result = evaluateRecall({
      keyPoints,
      recalledKeyPointIndexes: [0],
      selfAssessment: 100,
      text: '書いた内容',
    })
    expect(result.score).toBe(25)
    expect(result.selfAssessment).toBe(100)
  })

  it('すべて思い出せていれば 100 になる', () => {
    const result = evaluateRecall({
      keyPoints,
      recalledKeyPointIndexes: [0, 1, 2, 3],
      selfAssessment: null,
      text: 'x',
    })
    expect(result.score).toBe(100)
  })

  it('一つも選ばなければ 0 になる', () => {
    const result = evaluateRecall({
      keyPoints,
      recalledKeyPointIndexes: [],
      selfAssessment: 75,
      text: 'x',
    })
    expect(result.score).toBe(0)
  })

  it('重複した選択を二重に数えない', () => {
    const result = evaluateRecall({
      keyPoints,
      recalledKeyPointIndexes: [1, 1, 1],
      selfAssessment: null,
      text: 'x',
    })
    expect(result.recalledCount).toBe(1)
    expect(result.score).toBe(25)
  })

  it('範囲外の添字を無視する', () => {
    const result = evaluateRecall({
      keyPoints,
      recalledKeyPointIndexes: [0, 99, -1],
      selfAssessment: null,
      text: 'x',
    })
    expect(result.recalledCount).toBe(1)
  })

  it('Key Point がなければ自己評価に退避する', () => {
    const result = evaluateRecall({
      keyPoints: [],
      recalledKeyPointIndexes: [],
      selfAssessment: 75,
      text: 'x',
    })
    expect(result.method).toBe('self_assessment')
    expect(result.score).toBe(75)
  })

  it('評価器を差し替えられる（将来の意味的評価に対応する）', () => {
    const semantic: RecallEvaluator = {
      evaluate: (input) => ({
        score: 88,
        method: 'semantic',
        recalledCount: 3,
        totalCount: input.keyPoints.length,
        selfAssessment: input.selfAssessment,
      }),
    }
    const result = evaluateRecall(
      { keyPoints, recalledKeyPointIndexes: [], selfAssessment: null, text: 'x' },
      semantic,
    )
    expect(result.method).toBe('semantic')
    expect(result.score).toBe(88)
  })
})
