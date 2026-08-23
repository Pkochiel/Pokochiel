import { describe, expect, it } from 'vitest'
import {
  SACCADE,
  SACCADE_AXES,
  SACCADE_AXIS_LABELS,
  buildSaccadeSheet,
  saccadeAxisFor,
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
    expect(scoreSaccade(57, SACCADE.durationMs).laps).toBe(57)
  })

  it('8本ごとに1周と数える', () => {
    const result = scoreSaccade(19, SACCADE.durationMs)
    expect(result.sheets).toBe(2)
    expect(result.line).toBe(3)
  })

  it('ちょうど1周なら次の周の先頭に戻る', () => {
    const result = scoreSaccade(8, SACCADE.durationMs)
    expect(result.sheets).toBe(1)
    expect(result.line).toBe(0)
  })

  it('1分あたりに直した数も出す', () => {
    // 長さを変えても比べられるようにする。
    expect(scoreSaccade(30, 30_000).perMinute).toBe(60)
  })

  it('0 往復でも落ちない', () => {
    const result = scoreSaccade(0, SACCADE.durationMs)
    expect(result.laps).toBe(0)
    expect(result.sheets).toBe(0)
    expect(result.perMinute).toBe(0)
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

  it('公開スコアの範囲と噛み合っている', () => {
    // 30秒で50〜80往復という数字から逆算した刻みになっていること。
    const fastest = SACCADE.intervalsMs[SACCADE.intervalsMs.length - 1]!
    const slowest = SACCADE.intervalsMs[0]!
    expect(SACCADE.durationMs / fastest).toBeGreaterThanOrEqual(80)
    expect(SACCADE.durationMs / slowest).toBeLessThanOrEqual(50)
  })
})
