import type { AnswerRecord } from '../metrics/comprehension'

/**
 * Baseline Test の進行。
 *
 * 重要な不変条件をここで担保する。
 * - 読了前に設問へ進めない
 * - Recall のテキストを確定する前に自己評価の画面へ進めない
 *   （模範解答を見てから点を付けられると、指標が自己申告の水増しになるため）
 */
export type BaselinePhase =
  | 'ready'
  | 'reading'
  | 'questions'
  | 'recall_input'
  | 'recall_score'
  | 'result'

export interface BaselineFlowState {
  phase: BaselinePhase
  questionIndex: number
  answers: AnswerRecord[]
  recallText: string
  recallScore: number | null
}

export const initialBaselineFlowState: BaselineFlowState = {
  phase: 'ready',
  questionIndex: 0,
  answers: [],
  recallText: '',
  recallScore: null,
}

export type BaselineFlowEvent =
  | { type: 'start_reading' }
  | { type: 'finish_reading' }
  | { type: 'answer'; questionId: string; choiceId: string | null; totalQuestions: number }
  | { type: 'back_question' }
  | { type: 'set_recall_text'; text: string }
  | { type: 'submit_recall_text' }
  | { type: 'set_recall_score'; score: number }
  | { type: 'submit_recall_score' }

export function baselineFlowReducer(
  state: BaselineFlowState,
  event: BaselineFlowEvent,
): BaselineFlowState {
  switch (event.type) {
    case 'start_reading':
      return state.phase === 'ready' ? { ...state, phase: 'reading' } : state

    case 'finish_reading':
      return state.phase === 'reading' ? { ...state, phase: 'questions' } : state

    case 'answer': {
      if (state.phase !== 'questions') return state
      const answers = [
        ...state.answers.filter((a) => a.questionId !== event.questionId),
        { questionId: event.questionId, selectedChoiceId: event.choiceId },
      ]
      const nextIndex = state.questionIndex + 1
      const done = nextIndex >= event.totalQuestions
      return {
        ...state,
        answers,
        questionIndex: done ? state.questionIndex : nextIndex,
        phase: done ? 'recall_input' : 'questions',
      }
    }

    case 'back_question':
      if (state.phase !== 'questions' || state.questionIndex === 0) return state
      return { ...state, questionIndex: state.questionIndex - 1 }

    case 'set_recall_text':
      return state.phase === 'recall_input' ? { ...state, recallText: event.text } : state

    case 'submit_recall_text':
      // 空欄のまま模範解答を見せない
      if (state.phase !== 'recall_input' || state.recallText.trim().length === 0) return state
      return { ...state, phase: 'recall_score' }

    case 'set_recall_score':
      return state.phase === 'recall_score' ? { ...state, recallScore: event.score } : state

    case 'submit_recall_score':
      if (state.phase !== 'recall_score' || state.recallScore === null) return state
      return { ...state, phase: 'result' }
  }
}

/** 現在の設問に対する既存の回答（戻ったときに選択状態を復元するため）。 */
export function selectedChoiceFor(
  state: BaselineFlowState,
  questionId: string,
): string | null {
  return state.answers.find((a) => a.questionId === questionId)?.selectedChoiceId ?? null
}
