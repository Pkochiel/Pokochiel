import { describe, expect, it } from 'vitest'
import { PREDICTION } from '../config/training-config'
import { scorePrediction } from './prediction'

const answer = (quality: 'correct' | 'partial' | 'miss', written = false) => ({
  quality,
  hasWrittenPrediction: written,
})

describe('scorePrediction', () => {
  it('論点まで当たれば満点になる', () => {
    expect(scorePrediction([answer('correct')]).score).toBe(100)
  })

  it('論理方向が合っていれば部分点を与える', () => {
    expect(scorePrediction([answer('partial')]).score).toBe(PREDICTION.partialScore)
  })

  it('方向が違えば 0 点になる', () => {
    expect(scorePrediction([answer('miss')]).score).toBe(0)
  })

  it('完全一致でなくても評価される（部分点が 0 より大きい）', () => {
    expect(PREDICTION.partialScore).toBeGreaterThan(0)
  })

  it('自由記述を書くと加点される', () => {
    expect(scorePrediction([answer('partial', true)]).score).toBeGreaterThan(
      scorePrediction([answer('partial', false)]).score,
    )
  })

  it('加点しても上限を超えない', () => {
    expect(scorePrediction([answer('correct', true)]).score).toBe(PREDICTION.maxScore)
  })

  it('複数回答の平均を返す', () => {
    const result = scorePrediction([answer('correct'), answer('miss')])
    expect(result.score).toBe(50)
    expect(result.correct).toBe(1)
    expect(result.miss).toBe(1)
    expect(result.total).toBe(2)
  })

  it('論理方向が合っていた割合を返す', () => {
    const result = scorePrediction([answer('correct'), answer('partial'), answer('miss')])
    expect(result.directionRate).toBeCloseTo(2 / 3, 5)
  })

  it('回答がなくても落ちない', () => {
    expect(scorePrediction([]).score).toBe(0)
    expect(scorePrediction([]).directionRate).toBe(0)
  })
})
