import { describe, expect, it } from 'vitest'
import { MEANING_FLASH_ITEMS, selectMeaningFlashItems } from './meaning-flash'

describe('Meaning Flash 教材', () => {
  it('全レベルに教材がある', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(MEANING_FLASH_ITEMS.filter((i) => i.level === level).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('id が重複しない', () => {
    const ids = MEANING_FLASH_ITEMS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(MEANING_FLASH_ITEMS.map((i) => [i.id, i] as const))(
    '%s は一瞬で読める長さに収まっている',
    (_id, item) => {
      expect(item.characterCount).toBeGreaterThanOrEqual(20)
      expect(item.characterCount).toBeLessThanOrEqual(120)
    },
  )

  it.each(MEANING_FLASH_ITEMS.map((i) => [i.id, i] as const))(
    '%s は正解を選択肢の中に持ち、文言が重複しない',
    (_id, item) => {
      const ids = item.choices.map((c) => c.id)
      expect(ids).toContain(item.correctChoiceId)
      expect(new Set(item.choices.map((c) => c.text)).size).toBe(item.choices.length)
    },
  )

  it.each(MEANING_FLASH_ITEMS.map((i) => [i.id, i] as const))(
    '%s は意味を問う設問になっている（語句の再生を問わない）',
    (_id, item) => {
      expect(item.prompt).toContain('言いたかったこと')
    },
  )

  it('正解の位置が先頭に固定されていない', () => {
    const firstIsCorrect = MEANING_FLASH_ITEMS.filter(
      (i) => i.choices[0]?.id === i.correctChoiceId,
    ).length
    expect(firstIsCorrect).toBeLessThan(MEANING_FLASH_ITEMS.length)
  })

  it('レベルが上がるほど文章が長い傾向にある', () => {
    const meanAt = (level: 1 | 5) => {
      const items = MEANING_FLASH_ITEMS.filter((i) => i.level === level)
      return items.reduce((sum, i) => sum + i.characterCount, 0) / items.length
    }
    expect(meanAt(5)).toBeGreaterThan(meanAt(1))
  })
})

describe('selectMeaningFlashItems', () => {
  it('指定した件数を返す', () => {
    expect(selectMeaningFlashItems(2, 5, 'seed')).toHaveLength(5)
  })

  it('指定レベルの教材を優先する', () => {
    const items = selectMeaningFlashItems(3, 3, 'seed')
    expect(items.every((i) => i.level === 3)).toBe(true)
  })

  it('足りない場合は近いレベルで補う', () => {
    const items = selectMeaningFlashItems(3, 8, 'seed')
    expect(items).toHaveLength(8)
    expect(new Set(items.map((i) => i.level)).size).toBeGreaterThan(1)
  })

  it('同じ seed からは常に同じ並びを返す', () => {
    expect(selectMeaningFlashItems(2, 4, 'day-1').map((i) => i.id)).toEqual(
      selectMeaningFlashItems(2, 4, 'day-1').map((i) => i.id),
    )
  })

  it('seed が変われば並びが変わりうる', () => {
    const seeds = ['a', 'b', 'c', 'd'].map((s) =>
      selectMeaningFlashItems(2, 2, s).map((i) => i.id).join(','),
    )
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })
})
