import { describe, expect, it } from 'vitest'
import { UNIT_BOOK, UNIT_TEMPLATES, buildUnitBookQuestions, scoreUnitBook } from './unit-book'

const questions = (seed = 'day') => buildUnitBookQuestions({ seed })

describe('文の型', () => {
  it('どの型も差し替え箇所を3つ持つ', () => {
    for (const template of UNIT_TEMPLATES) expect(template.axes).toHaveLength(3)
  })

  it('3つの二択の総当たりで8通りになる', () => {
    for (const template of UNIT_TEMPLATES) {
      const texts = new Set<string>()
      for (let a = 0; a < 2; a += 1) {
        for (let b = 0; b < 2; b += 1) {
          for (let c = 0; c < 2; c += 1) texts.add(template.build([a, b, c]))
        }
      }
      expect(texts.size).toBe(8)
    }
  })
})

describe('buildUnitBookQuestions', () => {
  it('設定どおりの問数を作る', () => {
    expect(questions()).toHaveLength(UNIT_BOOK.questionCount)
  })

  it('8列を並べる', () => {
    for (const question of questions()) {
      expect(question.columns).toHaveLength(UNIT_BOOK.columns)
    }
  })

  it('列の文がすべて違う', () => {
    for (const question of questions()) {
      const texts = new Set(question.columns.map((column) => column.text))
      expect(texts.size).toBe(UNIT_BOOK.columns)
    }
  })

  it('position が並びの添字と一致する', () => {
    for (const question of questions()) {
      question.columns.forEach((column, index) => expect(column.position).toBe(index))
    }
  })

  it('お題が正解の列の文と一致する', () => {
    for (const question of questions()) {
      expect(question.columns[question.answerPosition]?.text).toBe(question.target)
    }
  })

  it('どの2列も1〜3か所しか違わない', () => {
    // 拾い読みで当たらないことがこの種目の要点。差が大きいと課題として成立しない。
    for (const question of questions().slice(0, 5)) {
      const texts = question.columns.map((column) => column.text)
      for (let i = 0; i < texts.length; i += 1) {
        for (let j = i + 1; j < texts.length; j += 1) {
          expect(texts[i]).not.toBe(texts[j])
        }
      }
    }
  })

  it('正解の位置が毎回同じにならない', () => {
    // 位置を覚えて答えられないようにする。
    const positions = new Set(questions().map((q) => q.answerPosition))
    expect(positions.size).toBeGreaterThan(3)
  })

  it('列の並びが問題ごとに変わる', () => {
    const [first, second] = questions()
    expect(first?.columns.map((c) => c.text)).not.toEqual(second?.columns.map((c) => c.text))
  })

  it('id が重複しない', () => {
    const ids = questions().map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('同じ種なら同じ出題になる', () => {
    expect(questions('x')).toEqual(questions('x'))
  })

  it('種が変われば出題が変わる', () => {
    expect(questions('x')).not.toEqual(questions('y'))
  })

  it('問数が 0 以下なら出題しない', () => {
    expect(buildUnitBookQuestions({ seed: 'day', count: 0 })).toEqual([])
  })
})

describe('制限時間の段階', () => {
  it('短くなる順に並んでいる', () => {
    const limits = UNIT_BOOK.timeLimits
    for (let i = 1; i < limits.length; i += 1) {
      expect(limits[i]!).toBeLessThan(limits[i - 1]!)
    }
  })

  it('上がる基準が戻る基準より高い', () => {
    expect(UNIT_BOOK.advanceAccuracy).toBeGreaterThan(UNIT_BOOK.fallbackAccuracy)
  })
})

describe('scoreUnitBook', () => {
  const allCorrect = () =>
    new Map(questions().map((question) => [question.id, question.answerPosition]))

  it('全問正解なら 100%', () => {
    const result = scoreUnitBook(questions(), allCorrect())
    expect(result.correct).toBe(UNIT_BOOK.questionCount)
    expect(result.accuracy).toBe(100)
  })

  it('誤答を数える', () => {
    const answers = allCorrect()
    const first = questions()[0]!
    answers.set(first.id, (first.answerPosition + 1) % UNIT_BOOK.columns)
    expect(scoreUnitBook(questions(), answers).wrong).toBe(1)
  })

  it('未回答を数える', () => {
    const result = scoreUnitBook(questions(), new Map())
    expect(result.unanswered).toBe(UNIT_BOOK.questionCount)
  })

  it('出題がなければ 0 を返す', () => {
    expect(scoreUnitBook([], new Map())).toEqual({
      correct: 0,
      wrong: 0,
      unanswered: 0,
      total: 0,
      accuracy: 0,
    })
  })
})
