import { describe, expect, it } from 'vitest'
import {
  SACCADE_AXES,
  buildSaccadeSchedule,
  saccadeAxisFor,
  scoreSaccade,
  type SaccadeAnswer,
} from './saccade'

const schedule = (seed = 'day') =>
  buildSaccadeSchedule({ axis: 'horizontal', intervalMs: 500, durationMs: 30_000, seed })

describe('saccadeAxisFor', () => {
  it('たて・よこのどちらかを返す', () => {
    for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      expect(SACCADE_AXES).toContain(saccadeAxisFor(day))
    }
  })

  it('同じ日なら同じ向きになる', () => {
    // 画面を開き直しただけで課題が変わると、記録の意味が壊れる。
    expect(saccadeAxisFor('2026-09-01')).toBe(saccadeAxisFor('2026-09-01'))
  })

  it('日が変われば向きが切り替わる日がある', () => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
    expect(new Set(days.map(saccadeAxisFor)).size).toBe(2)
  })
})

describe('buildSaccadeSchedule', () => {
  it('間隔で割り切った数だけ点灯する', () => {
    expect(schedule().steps).toHaveLength(60)
  })

  it('点灯の時刻が間隔どおりに並ぶ', () => {
    const steps = schedule().steps
    expect(steps[0]?.atMs).toBe(0)
    expect(steps[1]?.atMs).toBe(500)
    expect(steps[59]?.atMs).toBe(29_500)
  })

  it('同じ種なら同じ並びになる', () => {
    expect(schedule('a').steps).toEqual(schedule('a').steps)
  })

  it('種が変われば並びが変わる', () => {
    const a = schedule('a').steps.map((s) => s.side)
    const b = schedule('zzz').steps.map((s) => s.side)
    expect(a).not.toEqual(b)
  })

  it('完全な交互にはしない', () => {
    // 完全に交互だと目を閉じてリズムだけで当てられ、見て判断する課題でなくなる。
    const steps = schedule().steps
    const repeats = steps.filter((step, i) => i > 0 && step.side === steps[i - 1]?.side)
    expect(repeats.length).toBeGreaterThan(0)
  })

  it('左右の偏りが極端にならない', () => {
    const steps = schedule().steps
    const starts = steps.filter((step) => step.side === 'start').length
    expect(starts).toBeGreaterThan(steps.length * 0.3)
    expect(starts).toBeLessThan(steps.length * 0.7)
  })

  it('間隔や長さが 0 以下なら点灯しない', () => {
    const seed = 'x'
    expect(
      buildSaccadeSchedule({ axis: 'vertical', intervalMs: 0, durationMs: 1000, seed }).steps,
    ).toEqual([])
    expect(
      buildSaccadeSchedule({ axis: 'vertical', intervalMs: 500, durationMs: 0, seed }).steps,
    ).toEqual([])
  })
})

describe('scoreSaccade', () => {
  const answersFor = (correct: number): SaccadeAnswer[] =>
    schedule()
      .steps.slice(0, correct)
      .map((step) => ({ index: step.index, side: step.side }))

  it('正しく答えた回数を往復数にする', () => {
    expect(scoreSaccade(schedule(), answersFor(20)).hits).toBe(20)
  })

  it('答えなかったぶんを skipped として数える', () => {
    const result = scoreSaccade(schedule(), answersFor(20))
    expect(result.skipped).toBe(40)
    expect(result.total).toBe(60)
  })

  it('誤った側を答えたら miss になる', () => {
    const steps = schedule().steps
    const wrong: SaccadeAnswer[] = steps.slice(0, 5).map((step) => ({
      index: step.index,
      side: step.side === 'start' ? 'end' : 'start',
    }))
    const result = scoreSaccade(schedule(), wrong)
    expect(result.hits).toBe(0)
    expect(result.misses).toBe(5)
    expect(result.accuracy).toBe(0)
  })

  it('同じ点灯に何度答えても1回として数える', () => {
    // 連打で往復数を稼げないようにする。
    const step = schedule().steps[0]!
    const spammed: SaccadeAnswer[] = Array.from({ length: 50 }, () => ({
      index: step.index,
      side: step.side,
    }))
    expect(scoreSaccade(schedule(), spammed).hits).toBe(1)
  })

  it('連打の1回目が誤りなら、後から正解を足しても救われない', () => {
    const step = schedule().steps[0]!
    const wrongThenRight: SaccadeAnswer[] = [
      { index: step.index, side: step.side === 'start' ? 'end' : 'start' },
      { index: step.index, side: step.side },
    ]
    const result = scoreSaccade(schedule(), wrongThenRight)
    expect(result.hits).toBe(0)
    expect(result.misses).toBe(1)
  })

  it('答えたぶんに対する正答率を出す', () => {
    const steps = schedule().steps
    const mixed: SaccadeAnswer[] = [
      ...steps.slice(0, 3).map((step) => ({ index: step.index, side: step.side })),
      { index: steps[3]!.index, side: steps[3]!.side === 'start' ? 'end' : 'start' },
    ]
    // 4回答えて3回正解 → 75%。答えなかったぶんは分母に入れない。
    expect(scoreSaccade(schedule(), mixed).accuracy).toBe(75)
  })

  it('一度も答えなければ 0 になる', () => {
    const result = scoreSaccade(schedule(), [])
    expect(result.hits).toBe(0)
    expect(result.accuracy).toBe(0)
    expect(result.skipped).toBe(60)
  })
})
