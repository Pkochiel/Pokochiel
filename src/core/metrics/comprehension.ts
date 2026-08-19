import type { QuestionType, TrainingQuestion } from '../types/passage'

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
  /**
   * 設問タイプ別の正答率（0–100）。
   * Baseline Profile の Main Idea / Cause & Effect / Structure はここから作る。
   * 出題されなかったタイプは含めない（0 と未出題を区別する）。
   */
  byType: Partial<Record<QuestionType, number>>
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

  const byType: Partial<Record<QuestionType, number>> = {}
  const grouped = new Map<QuestionType, { correct: number; total: number }>()
  for (const [index, question] of questions.entries()) {
    const bucket = grouped.get(question.type) ?? { correct: 0, total: 0 }
    bucket.total += 1
    if (details[index]?.correct) bucket.correct += 1
    grouped.set(question.type, bucket)
  }
  for (const [type, bucket] of grouped) {
    byType[type] = Math.round((bucket.correct / bucket.total) * 100)
  }

  return {
    score: total === 0 ? null : Math.round((correctCount / total) * 100),
    correctCount,
    total,
    details,
    byType,
  }
}
