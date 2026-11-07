import { describe, expect, it } from 'vitest'
import { CHUNKING } from '../config/training-config'
import type { ChunkLevel } from '../types/common'
import { adaptChunkLevel, buildChunkGroups, chunkDisplayMs, splitLongUnit } from './segment'

const ATOMS = [
  '生成AIの普及によって',
  '企業の業務プロセスは',
  '大きく変化している。',
  '一方で、',
  '成果を出せている組織は',
  '限られている。',
]

describe('buildChunkGroups', () => {
  it.each([1, 2, 3, 4, 5] as ChunkLevel[])('Level %i でも本文を過不足なく覆う', (level) => {
    const groups = buildChunkGroups(ATOMS, level)
    expect(groups.map((g) => g.text).join('')).toBe(ATOMS.join(''))
  })

  it('Level 4 は意味単位そのまま（原子1つ）', () => {
    const groups = buildChunkGroups(ATOMS, 4)
    expect(groups).toHaveLength(ATOMS.length)
    expect(groups.map((g) => g.text)).toEqual(ATOMS)
    expect(groups.every((g) => g.unitCount === 1)).toBe(true)
  })

  it('Level 5 は複数の意味単位をまとめる', () => {
    const groups = buildChunkGroups(ATOMS, 5)
    expect(groups).toHaveLength(2)
    expect(groups[0]?.unitCount).toBe(3)
  })

  it('Level 3 は Level 1 より1回の表示が長い', () => {
    const short = buildChunkGroups(ATOMS, 1)
    const long = buildChunkGroups(ATOMS, 3)
    const mean = (gs: { characterCount: number }[]) =>
      gs.reduce((s, g) => s + g.characterCount, 0) / gs.length
    expect(mean(long)).toBeGreaterThan(mean(short))
  })

  it('文字数の窓を超えない', () => {
    for (const level of [1, 2, 3] as ChunkLevel[]) {
      const config = CHUNKING.levels[level]
      if (config.kind !== 'chars') continue
      for (const group of buildChunkGroups(ATOMS, level)) {
        expect(group.characterCount).toBeLessThanOrEqual(config.maxChars)
      }
    }
  })

  it('窓に収まる原子は分割しない（意味単位の内部を割らない）', () => {
    const atoms = ['企業の', '競争優位は', '組織能力による']
    // Level 2 は 8〜15 文字。いずれの原子も 15 文字以内なので原子の内部は割られない
    const groups = buildChunkGroups(atoms, 2)
    for (const group of groups) {
      expect(atoms.some((atom) => group.text.includes(atom))).toBe(true)
    }
  })

  it('空配列を渡しても落ちない', () => {
    expect(buildChunkGroups([], 2)).toEqual([])
  })

  it('空文字の原子を無視する', () => {
    expect(buildChunkGroups(['', 'あいうえお', ''], 4).map((g) => g.text)).toEqual(['あいうえお'])
  })

  it('同じ入力からは常に同じ結果になる', () => {
    expect(buildChunkGroups(ATOMS, 2)).toEqual(buildChunkGroups(ATOMS, 2))
  })
})

describe('splitLongUnit', () => {
  it('窓に収まる文字列は分割しない', () => {
    expect(splitLongUnit('短い文', 10)).toEqual(['短い文'])
  })

  it('助詞の直後で分割する', () => {
    const parts = splitLongUnit('企業の業務プロセスは大きく変化している', 12)
    expect(parts.join('')).toBe('企業の業務プロセスは大きく変化している')
    expect(parts[0]?.endsWith('は')).toBe(true)
  })

  it('窓を埋めたうえで、境界の直後で分割する', () => {
    const parts = splitLongUnit('一方で、成果を出せている組織は限られている', 10)
    expect(parts.join('')).toBe('一方で、成果を出せている組織は限られている')
    // 窓の中で最も後ろの境界（助詞・句読点）を選ぶ
    expect(parts[0]).toBe('一方で、成果を')
  })

  it('句点が窓内の最後の境界ならそこで分割する', () => {
    const parts = splitLongUnit('変化している。加えて', 8)
    expect(parts[0]).toBe('変化している。')
  })

  it('境界がなくても必ず分割して無限ループにならない', () => {
    const parts = splitLongUnit('アアアアアアアアアアアアアアアアアアアア', 5)
    expect(parts.join('')).toBe('アアアアアアアアアアアアアアアアアアアア')
    expect(parts.every((p) => p.length <= 5)).toBe(true)
  })

  it('分割後もすべての文字が保たれる', () => {
    const text = '多くの企業がDX投資を増やしているが、成果は限定的である。'
    expect(splitLongUnit(text, 8).join('')).toBe(text)
  })
})

describe('chunkDisplayMs', () => {
  it('目標速度から表示時間を決める', () => {
    // 600 CPM = 10 字/秒。10 文字なら 1000ms
    expect(chunkDisplayMs(10, 600)).toBe(1000)
  })

  it('速いほど表示時間が短くなる', () => {
    expect(chunkDisplayMs(20, 1200)).toBeLessThan(chunkDisplayMs(20, 600))
  })

  it('安全下限（250ms）を下回らない', () => {
    // 極端な速度を指定しても点滅が速くなりすぎない
    expect(chunkDisplayMs(1, 60_000)).toBe(CHUNKING.minDisplayMs)
    expect(chunkDisplayMs(5, 100_000)).toBeGreaterThanOrEqual(CHUNKING.minDisplayMs)
  })

  it('上限を超えない', () => {
    expect(chunkDisplayMs(1000, 10)).toBe(CHUNKING.maxDisplayMs)
  })

  it('速度が 0 以下でも落ちない', () => {
    expect(chunkDisplayMs(10, 0)).toBe(CHUNKING.maxDisplayMs)
  })
})

describe('adaptChunkLevel', () => {
  it('正答率が高ければレベルを上げる', () => {
    expect(adaptChunkLevel(2, 0.9)).toBe(3)
  })

  it('正答率が低ければレベルを下げる', () => {
    expect(adaptChunkLevel(3, 0.5)).toBe(2)
  })

  it('中間なら維持する', () => {
    expect(adaptChunkLevel(3, 0.75)).toBe(3)
  })

  it('範囲を超えない', () => {
    expect(adaptChunkLevel(5, 1)).toBe(5)
    expect(adaptChunkLevel(1, 0)).toBe(1)
  })

  it('閾値ちょうどの扱いが設定と一致する', () => {
    expect(adaptChunkLevel(2, CHUNKING.levelUpAccuracy)).toBe(3)
    expect(adaptChunkLevel(2, CHUNKING.levelDownAccuracy)).toBe(2)
  })
})
