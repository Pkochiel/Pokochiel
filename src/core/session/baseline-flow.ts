import type { AnswerRecord } from '../metrics/comprehension'

/**
 * Baseline Test の進行。
 *
 * 重要な不変条件をここで担保する。
 * - 読了前に設問へ進めない
 * - Recall のテキストを確定する前に Key Points を見せない
 *   （模範解答を見てから書けると、想起の測定にならないため）
 * - 想起スコアの主要値は Key Point の照合であり、自己評価は補助指標に留める
 */
export type BaselinePhase =
  | 'ready'
  | 'reading'
  | 'questions'
  | 'recall_input'
  | 'recall_review'
  | 'result'

export interface BaselineFlowState {
  phase: BaselinePhase
  questionIndex: number
  answers: AnswerRecord[]
  recallText: string
  /** 思い出せていたと申告した Key Point の添字。主要な想起スコアの根拠になる。 */
  recalledKeyPointIndexes: number[]
  /** 補助指標としての自己評価 */
  selfAssessment: number | null
}

export const initialBaselineFlowState: BaselineFlowState = {
  phase: 'ready',
  questionIndex: 0,
  answers: [],
  recallText: '',
  recalledKeyPointIndexes: [],
  selfAssessment: null,
}

export type BaselineFlowEvent =
  | { type: 'start_reading' }
  | { type: 'finish_reading' }
  | { type: 'answer'; questionId: string; choiceId: string | null; totalQuestions: number }
  | { type: 'back_question' }
  | { type: 'set_recall_text'; text: string }
  | { type: 'submit_recall_text' }
  | { type: 'toggle_key_point'; index: number }
  | { type: 'set_self_assessment'; score: number }
  | { type: 'submit_recall_review' }

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
      return { ...state, phase: 'recall_review' }

    case 'toggle_key_point': {
      if (state.phase !== 'recall_review') return state
      const selected = new Set(state.recalledKeyPointIndexes)
      if (selected.has(event.index)) selected.delete(event.index)
      else selected.add(event.index)
      return { ...state, recalledKeyPointIndexes: [...selected].sort((a, b) => a - b) }
    }

    case 'set_self_assessment':
      return state.phase === 'recall_review' ? { ...state, selfAssessment: event.score } : state

    case 'submit_recall_review':
      // 自己評価の選択を、内容を確認したことの合図として要求する
      if (state.phase !== 'recall_review' || state.selfAssessment === null) return state
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
