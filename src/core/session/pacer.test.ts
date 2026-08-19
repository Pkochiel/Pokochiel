import { describe, expect, it } from 'vitest'
import {
  charPositionAt,
  chunkIndexAt,
  chunkOffsets,
  pacerProgress,
  totalPacerSeconds,
} from './pacer'

const CHUNKS = ['生成AIの普及', 'によって', '企業の業務は', '変化している']

describe('chunkOffsets', () => {
  it('チャンクの累積位置を求める', () => {
    const offsets = chunkOffsets(['あいう', 'えお'])
    expect(offsets).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 5 },
    ])
  })

  it('空配列を渡しても落ちない', () => {
    expect(chunkOffsets([])).toEqual([])
  })

  it('最後の end が全文字数と一致する', () => {
    const offsets = chunkOffsets(CHUNKS)
    expect(offsets[offsets.length - 1]?.end).toBe(CHUNKS.join('').length)
  })
})

describe('charPositionAt', () => {
  it('600 CPM は毎秒 10 文字進む', () => {
    expect(charPositionAt(1, 600)).toBe(10)
    expect(charPositionAt(10, 600)).toBe(100)
  })

  it('速度が上がると同じ時間で先へ進む', () => {
    expect(charPositionAt(5, 1200)).toBeGreaterThan(charPositionAt(5, 600))
  })

  it('開始前や不正な速度では 0 を返す', () => {
    expect(charPositionAt(0, 600)).toBe(0)
    expect(charPositionAt(-1, 600)).toBe(0)
    expect(charPositionAt(10, 0)).toBe(0)
  })
})

describe('chunkIndexAt', () => {
  const offsets = chunkOffsets(CHUNKS)

  it('位置に対応するチャンクを返す', () => {
    expect(chunkIndexAt(offsets, 0)).toBe(0)
    expect(chunkIndexAt(offsets, 5)).toBe(0)
    expect(chunkIndexAt(offsets, 8)).toBe(1)
  })

  it('境界では次のチャンクに移る', () => {
    const first = offsets[0]
    expect(chunkIndexAt(offsets, (first?.end ?? 0) - 1)).toBe(0)
    expect(chunkIndexAt(offsets, first?.end ?? 0)).toBe(1)
  })

  it('末尾を超えても最後のチャンクに留まる', () => {
    expect(chunkIndexAt(offsets, 99_999)).toBe(CHUNKS.length - 1)
  })

  it('チャンクがなければ 0 を返す', () => {
    expect(chunkIndexAt([], 100)).toBe(0)
  })
})

describe('totalPacerSeconds', () => {
  it('全文を読み終えるまでの秒数を返す', () => {
    expect(totalPacerSeconds(600, 600)).toBe(60)
    expect(totalPacerSeconds(300, 600)).toBe(30)
  })

  it('速度が 0 なら終わらない', () => {
    expect(totalPacerSeconds(600, 0)).toBe(Infinity)
  })
})

describe('pacerProgress', () => {
  it('0〜1 に収まる', () => {
    expect(pacerProgress(0, 100)).toBe(0)
    expect(pacerProgress(50, 100)).toBe(0.5)
    expect(pacerProgress(200, 100)).toBe(1)
    expect(pacerProgress(-10, 100)).toBe(0)
  })

  it('文字数が 0 でもゼロ除算しない', () => {
    expect(pacerProgress(10, 0)).toBe(0)
  })
})
