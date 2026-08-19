import type { TrainingQuestion } from '../types/passage'

export interface AnswerRecord {
  questionId: string
  /** 未回答は null */
  selectedChoiceId: string | null
}

export interface ComprehensionResult {
  /** 0–100。出題がなければ null */
  score: number | null
  correctCount: number
  total: number
  /** 設問ごとの正誤。解説表示に使う */
  details: { questionId: string; correct: boolean; selectedChoiceId: string | null }[]
}

/**
 * 理解度スコア = 正答数 ÷ 出題数 × 100。
 * MVP では設問タイプによる重み付けを行わない（教材側で出題タイプの分布を担保する）。
 */
export function scoreComprehension(
  questions: readonly TrainingQuestion[],
  answers: readonly AnswerRecord[],
): ComprehensionResult {
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a.selectedChoiceId]))

  const details = questions.map((question) => {
    const selectedChoiceId = answerByQuestion.get(question.id) ?? null
    return {
      questionId: question.id,
      selectedChoiceId,
      correct: selectedChoiceId === question.correctChoiceId,
    }
  })

  const correctCount = details.filter((d) => d.correct).length
  const total = questions.length

  return {
    score: total === 0 ? null : Math.round((correctCount / total) * 100),
    correctCount,
    total,
    details,
  }
}
