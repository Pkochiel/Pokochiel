import { describe, expect, it } from 'vitest'
import { IMAGE_BOARD, scoreImageBoard } from './image-board'

const WORDS = Array.from({ length: 40 }, (_, i) => `語${i + 1}`)

describe('IMAGE_BOARD の設定', () => {
  it('40語・2セット', () => {
    expect(IMAGE_BOARD.wordCount).toBe(40)
    expect(IMAGE_BOARD.sets).toBe(2)
  })

  it('初級は2分', () => {
    expect(IMAGE_BOARD.timeLimits[0]).toBe(120_000)
  })

  it('級が上がるごとに短くなる', () => {
    const limits = IMAGE_BOARD.timeLimits
    for (let i = 1; i < limits.length; i += 1) {
      expect(limits[i]!).toBeLessThan(limits[i - 1]!)
    }
  })

  it('上がる基準が戻る基準より高い', () => {
    expect(IMAGE_BOARD.advanceRecalled).toBeGreaterThan(IMAGE_BOARD.fallbackRecalled)
  })
})

describe('scoreImageBoard', () => {
  it('再生できた語を数える', () => {
    const result = scoreImageBoard(WORDS, [{ index: 0, recalled: WORDS.slice(0, 12) }])
    expect(result.sets[0]?.recalled).toBe(12)
  })

  it('各セットのスコアを並びとして残す', () => {
    const result = scoreImageBoard(WORDS, [
      { index: 0, recalled: WORDS.slice(0, 20) },
      { index: 1, recalled: WORDS.slice(0, 28) },
    ])
    expect(result.attempts).toEqual([20, 28])
  })

  it('主スコアは2セットの良いほう', () => {
    // 合計にすると同じ語を2回数えることになり、覚えられた語数を表さない。
    const result = scoreImageBoard(WORDS, [
      { index: 0, recalled: WORDS.slice(0, 20) },
      { index: 1, recalled: WORDS.slice(0, 28) },
    ])
    expect(result.score).toBe(28)
  })

  it('どちらかで拾えた語の数を出す', () => {
    // 1セット目の取りこぼしを2セット目で拾えたかを見る。
    const result = scoreImageBoard(WORDS, [
      { index: 0, recalled: WORDS.slice(0, 10) },
      { index: 1, recalled: WORDS.slice(10, 25) },
    ])
    expect(result.score).toBe(15)
    expect(result.unionRecalled).toBe(25)
  })

  it('出題になかった語を intruded として数える', () => {
    const result = scoreImageBoard(WORDS, [
      { index: 0, recalled: [...WORDS.slice(0, 5), 'でたらめ', 'ありもしない'] },
    ])
    expect(result.sets[0]?.recalled).toBe(5)
    expect(result.sets[0]?.intruded).toBe(2)
  })

  it('同じ語を並べても1回として数える', () => {
    const first = WORDS[0]!
    const result = scoreImageBoard(WORDS, [{ index: 0, recalled: [first, first, first, first] }])
    expect(result.sets[0]?.recalled).toBe(1)
  })

  it('前後の空白は無視する', () => {
    const result = scoreImageBoard(WORDS, [
      { index: 0, recalled: ['  語1 ', '語2　', '　語 3　'] },
    ])
    expect(result.sets[0]?.recalled).toBe(3)
  })

  it('空行は数えない', () => {
    const result = scoreImageBoard(WORDS, [{ index: 0, recalled: ['', '   ', '　', WORDS[0]!] }])
    expect(result.sets[0]?.recalled).toBe(1)
    expect(result.sets[0]?.intruded).toBe(0)
  })

  it('全問正解なら出題数に一致する', () => {
    const result = scoreImageBoard(WORDS, [{ index: 0, recalled: WORDS }])
    expect(result.score).toBe(40)
    expect(result.unionRecalled).toBe(40)
  })

  it('セットがなければ 0 を返す', () => {
    const result = scoreImageBoard(WORDS, [])
    expect(result.score).toBe(0)
    expect(result.attempts).toEqual([])
    expect(result.unionRecalled).toBe(0)
    expect(result.total).toBe(40)
  })
})
