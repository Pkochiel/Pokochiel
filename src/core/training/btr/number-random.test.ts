import { describe, expect, it } from 'vitest'
import {
  NUMBER_RANDOM,
  buildNumberRandomSheet,
  buildNumberRandomSheets,
  combineNumberRandom,
  scoreSequential,
} from './number-random'

describe('数字ランダムの盤面', () => {
  it('1〜99 を置く', () => {
    const sheet = buildNumberRandomSheet('day', 0)
    expect(sheet.max).toBe(99)
    expect(sheet.points).toHaveLength(99)
  })

  it('1 から 99 が重複なく揃う', () => {
    const values = buildNumberRandomSheet('day', 0)
      .points.map((point) => point.value)
      .sort((a, b) => a - b)
    expect(values).toEqual(Array.from({ length: 99 }, (_, i) => i + 1))
  })

  it('4枚のシートを作る', () => {
    expect(buildNumberRandomSheets('day')).toHaveLength(NUMBER_RANDOM.sheets)
  })

  it('シートごとに配置が違う', () => {
    const [first, second] = buildNumberRandomSheets('day')
    expect(first?.points.map((p) => p.value)).not.toEqual(second?.points.map((p) => p.value))
  })

  it('同じ種なら同じ配置になる', () => {
    expect(buildNumberRandomSheet('day', 0)).toEqual(buildNumberRandomSheet('day', 0))
  })

  it('日が変われば配置が変わる', () => {
    expect(buildNumberRandomSheet('day-a', 0).points).not.toEqual(
      buildNumberRandomSheet('day-b', 0).points,
    )
  })

  it('位置が盤面の中に収まる', () => {
    for (const point of buildNumberRandomSheet('day', 0).points) {
      expect(point.x).toBeGreaterThan(0)
      expect(point.x).toBeLessThan(1)
      expect(point.y).toBeGreaterThan(0)
      expect(point.y).toBeLessThan(1)
    }
  })

  it('数字どうしが重ならない', () => {
    // 完全な乱数で置くと重なって読めなくなる。格子のマスを1つずつ使っている。
    const points = buildNumberRandomSheet('day', 0).points
    const cells = points.map(
      (point) =>
        `${Math.floor(point.x * NUMBER_RANDOM.gridColumns)},${Math.floor(point.y * NUMBER_RANDOM.gridRows)}`,
    )
    expect(new Set(cells).size).toBe(points.length)
  })

  it('整列させない', () => {
    // 整列していると視線が行を走るだけになり、盤面全体を走査する訓練にならない。
    const points = buildNumberRandomSheet('day', 0).points
    const xs = new Set(points.map((point) => point.x.toFixed(4)))
    expect(xs.size).toBeGreaterThan(NUMBER_RANDOM.gridColumns)
  })
})

describe('制限時間の段階', () => {
  it('短くなる順に並んでいる', () => {
    const limits = NUMBER_RANDOM.timeLimits
    for (let i = 1; i < limits.length; i += 1) {
      expect(limits[i]!).toBeLessThan(limits[i - 1]!)
    }
  })

  it('上がる基準が戻る基準より高い', () => {
    expect(NUMBER_RANDOM.advanceReached).toBeGreaterThan(NUMBER_RANDOM.fallbackReached)
  })
})

describe('scoreSequential', () => {
  it('1から順に押したぶんだけ進む', () => {
    expect(scoreSequential([1, 2, 3, 4, 5], 99).reached).toBe(5)
  })

  it('順番を飛ばした押下では進まない', () => {
    // 適当に押して数字だけ上げられないようにする。
    const result = scoreSequential([1, 2, 7, 3], 99)
    expect(result.reached).toBe(3)
    expect(result.wrong).toBe(1)
  })

  it('いきなり途中の数を押しても進まない', () => {
    const result = scoreSequential([50, 51, 52], 99)
    expect(result.reached).toBe(0)
    expect(result.wrong).toBe(3)
  })

  it('同じ数を連打しても進まない', () => {
    const result = scoreSequential([1, 1, 1, 1], 99)
    expect(result.reached).toBe(1)
    expect(result.wrong).toBe(3)
  })

  it('最大値を超えて進まない', () => {
    const taps = Array.from({ length: 12 }, (_, i) => i + 1)
    const result = scoreSequential(taps, 10)
    expect(result.reached).toBe(10)
    expect(result.wrong).toBe(2)
  })

  it('一つも押さなければ 0', () => {
    expect(scoreSequential([], 99)).toEqual({ reached: 0, wrong: 0, max: 99 })
  })
})

describe('combineNumberRandom', () => {
  it('4枚の到達数を並びとして残す', () => {
    // 記録は「22・20・18・24」の形で残したい。
    const results = [22, 20, 18, 24].map((reached) => ({ reached, wrong: 0, max: 99 }))
    expect(combineNumberRandom(results).attempts).toEqual([22, 20, 18, 24])
  })

  it('合計と平均を出す', () => {
    const results = [22, 20, 18, 24].map((reached) => ({ reached, wrong: 1, max: 99 }))
    const combined = combineNumberRandom(results)
    expect(combined.reached).toBe(84)
    expect(combined.average).toBe(21)
    expect(combined.wrong).toBe(4)
  })

  it('空でも落ちない', () => {
    expect(combineNumberRandom([])).toEqual({
      attempts: [],
      reached: 0,
      wrong: 0,
      average: 0,
    })
  })
})
