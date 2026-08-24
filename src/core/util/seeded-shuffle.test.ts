import { describe, expect, it } from 'vitest'
import { hashString, seededShuffle } from './seeded-shuffle'

describe('seededShuffle', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f']

  it('同じ seed からは常に同じ順序を返す', () => {
    expect(seededShuffle(items, 'passage-1')).toEqual(seededShuffle(items, 'passage-1'))
  })

  it('seed が違えば順序が変わりうる', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e'].map((s) => seededShuffle(items, s).join(''))
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })

  it('要素を落とさず、重複させない', () => {
    const shuffled = seededShuffle(items, 'seed')
    expect([...shuffled].sort()).toEqual([...items].sort())
  })

  it('元の配列を変更しない', () => {
    const original = [...items]
    seededShuffle(items, 'seed')
    expect(items).toEqual(original)
  })

  it('空配列と単一要素を扱える', () => {
    expect(seededShuffle([], 'seed')).toEqual([])
    expect(seededShuffle(['only'], 'seed')).toEqual(['only'])
  })
})

describe('hashString', () => {
  it('同じ入力からは同じ値を返す', () => {
    expect(hashString('speed-reading')).toBe(hashString('speed-reading'))
  })

  it('異なる入力を区別する', () => {
    expect(hashString('a')).not.toBe(hashString('b'))
  })
})
