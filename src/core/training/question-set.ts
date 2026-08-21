import { QUESTIONS } from '../config/training-config'
import type { QuestionType, TrainingQuestion } from '../types/passage'

export interface SelectQuestionsOptions {
  /** 出題する上限。教材の設問がこれより少なければ全問出す。 */
  limit: number
  /**
   * 優先度を下げる設問種別。
   * 直前のブロックで同じ観点を問い終えているものを後ろへ回す。
   */
  deprioritize?: readonly QuestionType[]
}

/**
 * ブロックに割り当てられた時間から、その回に出せる設問数を出す。
 *
 * 設問数を時間と切り離すと、2分のブロックにも6分のブロックと同じ数が並び、
 * 10分のセッションが20分のセッションと同じ設問数になる（実際そうなっていた）。
 * 設問に使ってよいのはブロック時間の一部までとし、残りは読む時間に充てる。
 *
 * @param minutes ブロックの割り当て分数
 * @param max その種類のブロックの上限問数
 */
export function questionBudget(minutes: number, max: number): number {
  if (max <= 0) return 0
  const affordable = Math.floor(
    (minutes * 60 * QUESTIONS.timeShare) / QUESTIONS.secondsPerQuestion,
  )
  return Math.min(max, Math.max(Math.min(QUESTIONS.minPerBlock, max), affordable))
}

/**
 * 教材の設問から、その回に出す分だけを選ぶ。
 *
 * 教材側の並び順（main_idea → detail → cause_effect → inference → structure）を保つ。
 * `deprioritize` に挙げた種別は最後に回すので、limit で切られたときに真っ先に落ちる。
 * 教材そのものは変えないため、同じ教材でも回によって出題を変えられる。
 */
export function selectQuestions(
  questions: readonly TrainingQuestion[],
  options: SelectQuestionsOptions,
): TrainingQuestion[] {
  if (options.limit <= 0) return []
  const deprioritize = options.deprioritize ?? []
  if (deprioritize.length === 0) return questions.slice(0, options.limit)

  const ordered = questions.map((question, index) => ({ question, index }))
  ordered.sort((a, b) => {
    const rankA = deprioritize.includes(a.question.type) ? 1 : 0
    const rankB = deprioritize.includes(b.question.type) ? 1 : 0
    if (rankA !== rankB) return rankA - rankB
    return a.index - b.index
  })

  return ordered
    .slice(0, options.limit)
    .sort((a, b) => a.index - b.index)
    .map(({ question }) => question)
}

/**
 * Comprehension ブロックの出題。
 *
 * Structure Reading と同じ教材を使うため、構成を問う設問は観点が重複する。
 * 問数は時間で減らさない（合格ライン 70% を判定できる粒度を保つため）。
 */
export function comprehensionQuestions(
  questions: readonly TrainingQuestion[],
): TrainingQuestion[] {
  return selectQuestions(questions, {
    limit: QUESTIONS.comprehension,
    deprioritize: QUESTIONS.deprioritizedInComprehension,
  })
}

/** 読めていたかの確認だけを目的とするブロックの出題。 */
export function readCheckQuestions(
  questions: readonly TrainingQuestion[],
  minutes: number,
): TrainingQuestion[] {
  return selectQuestions(questions, { limit: questionBudget(minutes, QUESTIONS.readCheck) })
}

/**
 * Structure Reading で要約を問う段落の番号。
 *
 * 本文は全段落を読ませ、設問だけを間引く。
 * 最初と最後は必ず含める（導入と結論は段落の役割がもっとも分かれるため）。
 * 残りは等間隔に選び、教材の長さが変わっても偏らないようにする。
 */
export function structureProbeIndexes(paragraphCount: number, minutes: number): number[] {
  const limit = questionBudget(minutes, QUESTIONS.structureProbes)
  if (paragraphCount <= 0 || limit <= 0) return []
  if (paragraphCount <= limit) return Array.from({ length: paragraphCount }, (_, i) => i)
  if (limit === 1) return [0]

  const step = (paragraphCount - 1) / (limit - 1)
  const picked = new Set<number>()
  for (let i = 0; i < limit; i += 1) picked.add(Math.round(i * step))

  // 丸めで重複した分は、まだ選んでいない段落から前詰めで補う。
  for (let i = 0; picked.size < limit && i < paragraphCount; i += 1) picked.add(i)

  return [...picked].sort((a, b) => a - b)
}
