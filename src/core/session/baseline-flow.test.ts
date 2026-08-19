import { describe, expect, it } from 'vitest'
import {
  baselineFlowReducer,
  initialBaselineFlowState,
  selectedChoiceFor,
  type BaselineFlowEvent,
  type BaselineFlowState,
} from './baseline-flow'

const run = (
  events: readonly BaselineFlowEvent[],
  from: BaselineFlowState = initialBaselineFlowState,
) => events.reduce(baselineFlowReducer, from)

const answerAll = (count: number): BaselineFlowEvent[] =>
  Array.from({ length: count }, (_, i) => ({
    type: 'answer' as const,
    questionId: `q${i + 1}`,
    choiceId: `q${i + 1}-a`,
    totalQuestions: count,
  }))

describe('baselineFlowReducer', () => {
  it('ready から順に進む', () => {
    const reading = run([{ type: 'start_reading' }])
    expect(reading.phase).toBe('reading')
    expect(run([{ type: 'finish_reading' }], reading).phase).toBe('questions')
  })

  it('読了前に設問へ進めない', () => {
    expect(run([{ type: 'finish_reading' }]).phase).toBe('ready')
  })

  it('全問回答すると Recall 入力へ進む', () => {
    const state = run([{ type: 'start_reading' }, { type: 'finish_reading' }, ...answerAll(5)])
    expect(state.phase).toBe('recall_input')
    expect(state.answers).toHaveLength(5)
  })

  it('最終問の手前では設問のままである', () => {
    const state = run([
      { type: 'start_reading' },
      { type: 'finish_reading' },
      ...answerAll(5).slice(0, 4),
    ])
    expect(state.phase).toBe('questions')
    expect(state.questionIndex).toBe(4)
  })

  it('未回答（null）でも先へ進める', () => {
    const state = run([
      { type: 'start_reading' },
      { type: 'finish_reading' },
      { type: 'answer', questionId: 'q1', choiceId: null, totalQuestions: 1 },
    ])
    expect(state.phase).toBe('recall_input')
    expect(state.answers[0]?.selectedChoiceId).toBeNull()
  })

  it('前の設問に戻って回答を上書きできる', () => {
    let state = run([
      { type: 'start_reading' },
      { type: 'finish_reading' },
      { type: 'answer', questionId: 'q1', choiceId: 'q1-a', totalQuestions: 3 },
      { type: 'back_question' },
    ])
    expect(state.questionIndex).toBe(0)
    expect(selectedChoiceFor(state, 'q1')).toBe('q1-a')

    state = baselineFlowReducer(state, {
      type: 'answer',
      questionId: 'q1',
      choiceId: 'q1-b',
      totalQuestions: 3,
    })
    expect(state.answers.filter((a) => a.questionId === 'q1')).toHaveLength(1)
    expect(selectedChoiceFor(state, 'q1')).toBe('q1-b')
  })

  it('最初の設問では戻れない', () => {
    const state = run([{ type: 'start_reading' }, { type: 'finish_reading' }])
    expect(baselineFlowReducer(state, { type: 'back_question' }).questionIndex).toBe(0)
  })

  describe('Recall', () => {
    const untilRecall = run([
      { type: 'start_reading' },
      { type: 'finish_reading' },
      ...answerAll(5),
    ])

    it('テキストを入力しないと自己評価へ進めない（模範解答を先に見せない）', () => {
      expect(baselineFlowReducer(untilRecall, { type: 'submit_recall_text' }).phase).toBe(
        'recall_input',
      )
    })

    it('空白だけの入力でも進めない', () => {
      const state = run(
        [{ type: 'set_recall_text', text: '   \n  ' }, { type: 'submit_recall_text' }],
        untilRecall,
      )
      expect(state.phase).toBe('recall_input')
    })

    it('入力を確定すると自己評価へ進む', () => {
      const state = run(
        [{ type: 'set_recall_text', text: '要点1\n要点2\n要点3' }, { type: 'submit_recall_text' }],
        untilRecall,
      )
      expect(state.phase).toBe('recall_score')
    })

    it('自己評価を選ばないと結果へ進めない', () => {
      const state = run(
        [
          { type: 'set_recall_text', text: '要点' },
          { type: 'submit_recall_text' },
          { type: 'submit_recall_score' },
        ],
        untilRecall,
      )
      expect(state.phase).toBe('recall_score')
    })

    it('自己評価を選ぶと結果へ進む', () => {
      const state = run(
        [
          { type: 'set_recall_text', text: '要点' },
          { type: 'submit_recall_text' },
          { type: 'set_recall_score', score: 75 },
          { type: 'submit_recall_score' },
        ],
        untilRecall,
      )
      expect(state.phase).toBe('result')
      expect(state.recallScore).toBe(75)
    })

    it('Recall 入力段階では自己評価を受け付けない', () => {
      const state = baselineFlowReducer(untilRecall, { type: 'set_recall_score', score: 100 })
      expect(state.recallScore).toBeNull()
    })
  })

  it('順序を飛ばすイベントは無視される', () => {
    const state = run([
      { type: 'answer', questionId: 'q1', choiceId: 'a', totalQuestions: 5 },
      { type: 'set_recall_text', text: 'x' },
      { type: 'submit_recall_score' },
    ])
    expect(state).toEqual(initialBaselineFlowState)
  })
})
