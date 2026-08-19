import { describe, expect, it } from 'vitest'
import { VARIABLE_SPEED } from '../config/training-config'
import type { SegmentImportance, SpeedBand } from '../types/passage'
import { cpmForBand, scoreVariableSpeed, type SegmentChoice } from './variable-speed'

const choice = (
  importance: SegmentImportance,
  recommendedBand: SpeedBand,
  chosenBand: SpeedBand,
  paragraphIndex = 0,
): SegmentChoice => ({
  paragraphIndex,
  importance,
  recommendedBand,
  chosenBand,
  dwellMs: 4000,
})

describe('scoreVariableSpeed', () => {
  it('推奨帯と一致すれば満点になる', () => {
    const result = scoreVariableSpeed([
      choice('claim', 'slow', 'slow'),
      choice('example', 'fast', 'fast', 1),
    ])
    expect(result.score).toBe(100)
    expect(result.matched).toBe(2)
  })

  it('隣接する帯なら部分点になる', () => {
    expect(scoreVariableSpeed([choice('evidence', 'normal', 'fast')]).score).toBe(
      VARIABLE_SPEED.adjacentScore,
    )
  })

  it('正反対の帯なら 0 点になる', () => {
    expect(scoreVariableSpeed([choice('known', 'fast', 'slow')]).score).toBe(0)
  })

  it('主張を速く読み飛ばすと追加で減点する', () => {
    const skipped = scoreVariableSpeed([choice('claim', 'slow', 'fast')]).score
    const merelyOpposite = scoreVariableSpeed([choice('known', 'fast', 'slow')]).score
    expect(skipped).toBeLessThanOrEqual(merelyOpposite)
    expect(skipped).toBe(0)
  })

  it('核心を速く流した場合も減点対象になる', () => {
    const normalRead = scoreVariableSpeed([choice('key', 'slow', 'normal')]).score
    const fastRead = scoreVariableSpeed([choice('key', 'slow', 'fast')]).score
    expect(fastRead).toBeLessThan(normalRead)
  })

  it('速く読むこと自体は減点しない（低優先の区間なら満点）', () => {
    expect(scoreVariableSpeed([choice('known', 'fast', 'fast')]).score).toBe(100)
  })

  it('落とすべきだった区間を指摘する', () => {
    const result = scoreVariableSpeed([
      choice('claim', 'slow', 'fast', 0),
      choice('example', 'fast', 'fast', 1),
    ])
    expect(result.shouldHaveSlowed).toHaveLength(1)
    expect(result.shouldHaveSlowed[0]?.paragraphIndex).toBe(0)
    expect(result.shouldHaveSlowed[0]?.message).toContain('読み飛ばし')
  })

  it('速く通過してよかった区間を指摘する', () => {
    const result = scoreVariableSpeed([choice('example', 'fast', 'slow', 2)])
    expect(result.couldHaveSkimmed).toHaveLength(1)
    expect(result.couldHaveSkimmed[0]?.paragraphIndex).toBe(2)
  })

  it('区間ごとのフィードバックを返す', () => {
    const result = scoreVariableSpeed([
      choice('claim', 'slow', 'slow', 0),
      choice('example', 'fast', 'slow', 1),
    ])
    expect(result.segments).toHaveLength(2)
    expect(result.segments[0]?.message).toBeTruthy()
    expect(result.segments[1]?.message).toBeTruthy()
  })

  it('滞在時間を保持する', () => {
    const result = scoreVariableSpeed([{ ...choice('claim', 'slow', 'slow'), dwellMs: 12_000 }])
    expect(result.segments[0]?.dwellMs).toBe(12_000)
  })

  it('区間がなくても落ちない', () => {
    expect(scoreVariableSpeed([]).score).toBe(0)
  })

  it('全区間を速く読んでも高得点にならない（CPM 競争にしない）', () => {
    const allFast = scoreVariableSpeed([
      choice('claim', 'slow', 'fast', 0),
      choice('key', 'slow', 'fast', 1),
      choice('evidence', 'normal', 'fast', 2),
      choice('example', 'fast', 'fast', 3),
    ])
    expect(allFast.score).toBeLessThan(50)
  })
})

describe('cpmForBand', () => {
  it('帯ごとに速度を変える', () => {
    expect(cpmForBand(600, 'slow')).toBeLessThan(600)
    expect(cpmForBand(600, 'normal')).toBe(600)
    expect(cpmForBand(600, 'fast')).toBeGreaterThan(600)
  })
})
