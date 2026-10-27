import { describe, expect, it } from 'vitest'
import {
  LOGICAL_TEST,
  buildLogicalQuestions,
  scoreLogicalTest,
  type LogicalAnswer,
} from './logical-test'

const questions = (seed = 'day') => buildLogicalQuestions(seed)

describe('buildLogicalQuestions', () => {
  it('設定どおりの問数を作る', () => {
    expect(questions()).toHaveLength(LOGICAL_TEST.questionCount)
  })

  it('順序関係と三段論法を混ぜる', () => {
    // 片方の型に慣れて解けるだけにしない。
    const forms = new Set(questions().map((q) => q.form))
    expect(forms).toEqual(new Set(['ordering', 'syllogism']))
  })

  it('3通りの答えがすべて出る', () => {
    // 正解が2択だと当てずっぽうで半分当たってしまう。
    const answers = new Set(questions().map((q) => q.answer))
    expect(answers).toEqual(new Set(['true', 'false', 'unknown']))
  })

  it('「判断できない」だけに偏らない', () => {
    const unknown = questions().filter((q) => q.answer === 'unknown').length
    expect(unknown).toBeGreaterThan(2)
    expect(unknown).toBeLessThan(LOGICAL_TEST.questionCount * 0.6)
  })

  it('どの問題も前提と結論を持つ', () => {
    for (const question of questions()) {
      expect(question.premises.length).toBeGreaterThanOrEqual(2)
      expect(question.conclusion.length).toBeGreaterThan(0)
    }
  })

  it('id が重複しない', () => {
    const ids = questions().map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('同じ種なら同じ出題になる', () => {
    // 画面を開き直しただけで課題が変わると、記録の意味が壊れる。
    expect(questions('x')).toEqual(questions('x'))
  })

  it('種が変われば出題が変わる', () => {
    expect(questions('x')).not.toEqual(questions('y'))
  })

  it('問数を指定できる', () => {
    expect(buildLogicalQuestions('day', 6)).toHaveLength(6)
  })

  it('問数が 0 以下なら出題しない', () => {
    expect(buildLogicalQuestions('day', 0)).toEqual([])
    expect(buildLogicalQuestions('day', -1)).toEqual([])
  })

  it('順序関係の問題は同じ人物を重複させない', () => {
    // 「あきらはあきらより背が高い」のような問題を作らない。
    for (const question of questions().filter((q) => q.form === 'ordering')) {
      const text = [...question.premises, question.conclusion].join('')
      const names = ['あきら', 'いずみ', 'うたの', 'えいじ', 'おさむ', 'かなえ', 'きよし', 'くるみ']
      for (const name of names) {
        // 同じ文の中に同じ名前が2回出てこない
        for (const sentence of [...question.premises, question.conclusion]) {
          const occurrences = sentence.split(name).length - 1
          expect(occurrences).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('三段論法の問題は3つの集合が別々になる', () => {
    for (const question of questions().filter((q) => q.form === 'syllogism')) {
      const matched = question.premises[0]?.match(/^すべての(.+?)は(.+?)である$/)
      expect(matched?.[1]).not.toBe(matched?.[2])
    }
  })
})

describe('制限時間の段階', () => {
  it('短くなる順に並んでいる', () => {
    const limits = LOGICAL_TEST.timeLimits
    for (let i = 1; i < limits.length; i += 1) {
      expect(limits[i]!).toBeLessThan(limits[i - 1]!)
    }
  })

  it('最短の段が教室のトップ層に届く', () => {
    // 30問を1分30秒で終えるのがトップ層。そこを最短に置いている。
    expect(limits().at(-1)).toBe(90_000)
  })

  it('上がる基準が戻る基準より高い', () => {
    expect(LOGICAL_TEST.advanceAccuracy).toBeGreaterThan(LOGICAL_TEST.fallbackAccuracy)
  })
})

const limits = () => LOGICAL_TEST.timeLimits

describe('scoreLogicalTest', () => {
  const allCorrect = () => {
    const map = new Map<string, LogicalAnswer>()
    for (const question of questions()) map.set(question.id, question.answer)
    return map
  }

  it('全問正解なら 100%', () => {
    const result = scoreLogicalTest(questions(), allCorrect())
    expect(result.correct).toBe(LOGICAL_TEST.questionCount)
    expect(result.accuracy).toBe(100)
  })

  it('誤答を数える', () => {
    const answers = allCorrect()
    const first = questions()[0]!
    answers.set(first.id, first.answer === 'true' ? 'false' : 'true')
    const result = scoreLogicalTest(questions(), answers)
    expect(result.wrong).toBe(1)
    expect(result.correct).toBe(LOGICAL_TEST.questionCount - 1)
  })

  it('未回答を数える', () => {
    const answers = new Map<string, LogicalAnswer>()
    const first = questions()[0]!
    answers.set(first.id, first.answer)
    const result = scoreLogicalTest(questions(), answers)
    expect(result.unanswered).toBe(LOGICAL_TEST.questionCount - 1)
  })

  it('正答率の分母は出題数（未回答も含む）', () => {
    // 1問だけ答えて正解しても 100% にはしない。時間内にどれだけ処理できたかを見る種目のため。
    const answers = new Map<string, LogicalAnswer>()
    const first = questions()[0]!
    answers.set(first.id, first.answer)
    expect(scoreLogicalTest(questions(), answers).accuracy).toBeLessThan(10)
  })

  it('出題がなければ 0 を返す', () => {
    expect(scoreLogicalTest([], new Map())).toEqual({
      correct: 0,
      wrong: 0,
      unanswered: 0,
      total: 0,
      accuracy: 0,
    })
  })
})
