import { describe, expect, it } from 'vitest'
import {
  SACCADE,
  SACCADE_AXES,
  SACCADE_AXIS_LABELS,
  buildSaccadeSheet,
  saccadeAxisFor,
  saccadeLapMs,
  scoreSaccade,
} from './saccade'

describe('saccadeAxisFor', () => {
  it('たてかよこのどちらかを返す', () => {
    for (let i = 0; i < 30; i += 1) {
      expect(SACCADE_AXES).toContain(saccadeAxisFor(`day-${i}`))
    }
  })

  it('同じ日なら同じ向きになる', () => {
    // 開き直しただけで課題が変わると、記録の意味が壊れる。
    expect(saccadeAxisFor('2026-08-22')).toBe(saccadeAxisFor('2026-08-22'))
  })

  it('日が変われば向きも変わりうる', () => {
    const seen = new Set(Array.from({ length: 30 }, (_, i) => saccadeAxisFor(`day-${i}`)))
    expect(seen.size).toBe(2)
  })

  it('両方の向きに名前がある', () => {
    expect(SACCADE_AXIS_LABELS.vertical).toBe('たてサッケイド')
    expect(SACCADE_AXIS_LABELS.horizontal).toBe('よこサッケイド')
  })
})

describe('buildSaccadeSheet', () => {
  it('既定で8本の線を作る', () => {
    // 実物のシートがたて8列・よこ8行。
    expect(buildSaccadeSheet()).toHaveLength(SACCADE.lines)
    expect(SACCADE.lines).toBe(8)
  })

  it('線に通し番号を振る', () => {
    expect(buildSaccadeSheet().map((line) => line.index)).toEqual(
      Array.from({ length: SACCADE.lines }, (_, i) => i),
    )
  })

  it('等間隔に並べる', () => {
    // 視線を動かす距離を一定に保つため、間隔は揃える。
    const offsets = buildSaccadeSheet(5).map((line) => line.offset)
    const gaps = offsets.slice(1).map((offset, i) => offset - offsets[i]!)
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 10)
  })

  it('両端まで使う', () => {
    const offsets = buildSaccadeSheet(8).map((line) => line.offset)
    expect(offsets[0]).toBe(0)
    expect(offsets[offsets.length - 1]).toBe(1)
  })

  it('1本なら真ん中に置く', () => {
    expect(buildSaccadeSheet(1)).toEqual([{ index: 0, offset: 0.5 }])
  })

  it('0 本以下なら空', () => {
    expect(buildSaccadeSheet(0)).toEqual([])
    expect(buildSaccadeSheet(-3)).toEqual([])
  })
})

describe('scoreSaccade', () => {
  it('往復数をそのままスコアにする', () => {
    expect(scoreSaccade(7, SACCADE.durationMs).laps).toBe(7)
  })

  it('1往復は8本ぶん', () => {
    // 1本ずつ端から端へ送り、8本すべてを通ったところで1往復。
    expect(scoreSaccade(7, SACCADE.durationMs).lineTraversals).toBe(7 * SACCADE.lines)
  })

  it('1本あたりの時間を出す', () => {
    // 段の目安（1本あたりの時間）と直に比べられるようにする。
    // 30秒で6往復 = 48本 → 625ms/本。
    expect(scoreSaccade(6, 30_000).msPerLine).toBe(625)
  })

  it('1分あたりに直した数も出す', () => {
    // 長さを変えても比べられるようにする。
    expect(scoreSaccade(6, 30_000).perMinute).toBe(12)
  })

  it('0 往復でも落ちない', () => {
    const result = scoreSaccade(0, SACCADE.durationMs)
    expect(result.laps).toBe(0)
    expect(result.lineTraversals).toBe(0)
    expect(result.perMinute).toBe(0)
    expect(result.msPerLine).toBe(0)
  })

  it('負や小数は切り詰める', () => {
    // 押し間違いや丸めで妙な値が入っても、記録は整数の往復数に保つ。
    expect(scoreSaccade(-5, SACCADE.durationMs).laps).toBe(0)
    expect(scoreSaccade(12.7, SACCADE.durationMs).laps).toBe(12)
  })

  it('時間が 0 なら分速を出さない', () => {
    expect(scoreSaccade(10, 0).perMinute).toBe(0)
  })
})

describe('段の刻み', () => {
  it('上の段ほど1往復にかける時間が短い', () => {
    const steps = SACCADE.intervalsMs
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]!).toBeLessThan(steps[i - 1]!)
    }
  })

  it('1往復は8本ぶんの時間になる', () => {
    for (const interval of SACCADE.intervalsMs) {
      expect(saccadeLapMs(interval)).toBe(interval * SACCADE.lines)
    }
  })

  it('どの段も30秒で数往復はできる刻みになっている', () => {
    // 1往復に30秒近くかかる刻みだと、30秒の中で数えるものがなくなる。
    for (const interval of SACCADE.intervalsMs) {
      const laps = SACCADE.durationMs / saccadeLapMs(interval)
      expect(laps).toBeGreaterThanOrEqual(3)
      expect(laps).toBeLessThanOrEqual(20)
    }
  })
})
