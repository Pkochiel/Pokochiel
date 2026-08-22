import { describe, expect, it } from 'vitest'
import { IMAGE_MEMORY } from '@/core/training/btr/image-memory'
import { IMAGE_WORDS, pickImageWords, toImagePairs } from './image-words'

describe('IMAGE_WORDS', () => {
  it('40語を選べるだけの数がある', () => {
    expect(IMAGE_WORDS.length).toBeGreaterThanOrEqual(IMAGE_MEMORY.wordCount * 2)
  })

  it('重複がない', () => {
    expect(new Set(IMAGE_WORDS).size).toBe(IMAGE_WORDS.length)
  })

  it('空の語がない', () => {
    for (const word of IMAGE_WORDS) expect(word.trim().length).toBeGreaterThan(0)
  })
})

describe('pickImageWords', () => {
  it('設定どおりの語数を選ぶ', () => {
    expect(pickImageWords('day')).toHaveLength(IMAGE_MEMORY.wordCount)
  })

  it('選んだ語に重複がない', () => {
    const picked = pickImageWords('day')
    expect(new Set(picked).size).toBe(picked.length)
  })

  it('すべて一覧に載っている語である', () => {
    for (const word of pickImageWords('day')) expect(IMAGE_WORDS).toContain(word)
  })

  it('同じ種なら同じ語を選ぶ', () => {
    expect(pickImageWords('x')).toEqual(pickImageWords('x'))
  })

  it('種が変われば語が変わる', () => {
    expect(pickImageWords('x')).not.toEqual(pickImageWords('y'))
  })

  it('語数を指定できる', () => {
    expect(pickImageWords('day', 12)).toHaveLength(12)
  })

  it('0 以下なら選ばない', () => {
    expect(pickImageWords('day', 0)).toEqual([])
    expect(pickImageWords('day', -3)).toEqual([])
  })

  it('一覧より多く求めても落ちない', () => {
    // 足りなければあるだけ返す。無限に回らないこと。
    const picked = pickImageWords('day', 10_000)
    expect(picked.length).toBeLessThanOrEqual(IMAGE_WORDS.length)
    expect(new Set(picked).size).toBe(picked.length)
  })

  it('隣り合う語が同じ分野で固まらない', () => {
    // 固まると連想でつながってしまい、1語ずつイメージを作る訓練にならない。
    // 分野をまたいで1語ずつ拾うので、先頭のほうは必ず別分野になる。
    const picked = pickImageWords('day')
    const kitchen = ['やかん', 'まな板', 'おたま', '茶碗', '冷蔵庫', 'フライパン', '水筒', 'ざる']
    let consecutive = 0
    let worst = 0
    for (const word of picked) {
      consecutive = kitchen.includes(word) ? consecutive + 1 : 0
      worst = Math.max(worst, consecutive)
    }
    expect(worst).toBeLessThanOrEqual(1)
  })
})

describe('toImagePairs', () => {
  it('2語ずつの組にする', () => {
    expect(toImagePairs(['a', 'b', 'c', 'd'])).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('奇数なら最後の組の下は空になる', () => {
    expect(toImagePairs(['a', 'b', 'c'])).toEqual([
      ['a', 'b'],
      ['c', null],
    ])
  })

  it('40語なら20組になる', () => {
    expect(toImagePairs(pickImageWords('day'))).toHaveLength(20)
  })

  it('空なら組も空', () => {
    expect(toImagePairs([])).toEqual([])
  })
})
