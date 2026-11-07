import { describe, expect, it } from 'vitest'
import { scoreComprehension } from './comprehension'
import type { TrainingQuestion } from '../types/passage'

const question = (id: string, correct: string): TrainingQuestion => ({
  id,
  passageId: 'p1',
  type: 'detail',
  prompt: `${id}?`,
  choices: [
    { id: `${id}-a`, text: 'a' },
    { id: `${id}-b`, text: 'b' },
  ],
  correctChoiceId: correct,
  explanation: '',
})

const QUESTIONS = [
  question('q1', 'q1-a'),
  question('q2', 'q2-a'),
  question('q3', 'q3-a'),
  question('q4', 'q4-a'),
]

describe('scoreComprehension', () => {
  it('全問正解で 100 になる', () => {
    const result = scoreComprehension(
      QUESTIONS,
      QUESTIONS.map((q) => ({ questionId: q.id, selectedChoiceId: q.correctChoiceId })),
    )
    expect(result.score).toBe(100)
    expect(result.correctCount).toBe(4)
  })

  it('全問不正解で 0 になる', () => {
    const result = scoreComprehension(
      QUESTIONS,
      QUESTIONS.map((q) => ({ questionId: q.id, selectedChoiceId: `${q.id}-b` })),
    )
    expect(result.score).toBe(0)
  })

  it('正答率を 0〜100 で返す', () => {
    const result = scoreComprehension(QUESTIONS, [
      { questionId: 'q1', selectedChoiceId: 'q1-a' },
      { questionId: 'q2', selectedChoiceId: 'q2-a' },
      { questionId: 'q3', selectedChoiceId: 'q3-b' },
      { questionId: 'q4', selectedChoiceId: 'q4-b' },
    ])
    expect(result.score).toBe(50)
  })

  it('未回答は不正解として扱う', () => {
    const result = scoreComprehension(QUESTIONS, [
      { questionId: 'q1', selectedChoiceId: 'q1-a' },
      { questionId: 'q2', selectedChoiceId: null },
    ])
    expect(result.correctCount).toBe(1)
    expect(result.score).toBe(25)
  })

  it('回答が1件もなくても落ちない', () => {
    expect(scoreComprehension(QUESTIONS, []).score).toBe(0)
  })

  it('出題がなければ null を返す（0 と区別する）', () => {
    const result = scoreComprehension([], [])
    expect(result.score).toBeNull()
    expect(result.total).toBe(0)
  })

  it('設問に存在しない回答は無視する', () => {
    const result = scoreComprehension(QUESTIONS, [
      { questionId: 'q1', selectedChoiceId: 'q1-a' },
      { questionId: 'unknown', selectedChoiceId: 'x' },
    ])
    expect(result.total).toBe(4)
    expect(result.correctCount).toBe(1)
  })

  it('設問ごとの正誤を返す（解説表示に使う）', () => {
    const result = scoreComprehension(QUESTIONS, [
      { questionId: 'q1', selectedChoiceId: 'q1-a' },
    ])
    expect(result.details).toHaveLength(4)
    expect(result.details[0]).toEqual({
      questionId: 'q1',
      selectedChoiceId: 'q1-a',
      correct: true,
    })
    expect(result.details[1]?.correct).toBe(false)
  })

  it('端数を四捨五入する', () => {
    const three = QUESTIONS.slice(0, 3)
    const result = scoreComprehension(three, [
      { questionId: 'q1', selectedChoiceId: 'q1-a' },
      { questionId: 'q2', selectedChoiceId: 'q2-a' },
    ])
    expect(result.score).toBe(67)
  })
})
