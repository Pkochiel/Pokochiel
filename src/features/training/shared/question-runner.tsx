'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { AnswerRecord } from '@/core/metrics/comprehension'
import type { TrainingQuestion } from '@/core/types'

const QUESTION_TYPE_LABELS: Record<TrainingQuestion['type'], string> = {
  main_idea: '主張',
  detail: '詳細',
  cause_effect: '因果関係',
  inference: '推論',
  structure: '構成',
}

export interface QuestionRunnerProps {
  questions: readonly TrainingQuestion[]
  title?: string
  onComplete: (answers: AnswerRecord[]) => void
}

/** 設問を1問ずつ提示する。本文は表示しない（記憶と理解を測るため）。 */
export function QuestionRunner({ questions, title, onComplete }: QuestionRunnerProps) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const question = questions[index]

  if (!question) return null

  const select = (choiceId: string) => {
    const next = [
      ...answers.filter((a) => a.questionId !== question.id),
      { questionId: question.id, selectedChoiceId: choiceId },
    ]
    setAnswers(next)
    if (index + 1 >= questions.length) {
      onComplete(next)
      return
    }
    setIndex(index + 1)
  }

  const selected = answers.find((a) => a.questionId === question.id)?.selectedChoiceId ?? null

  return (
    <div>
      <p className="flex items-center gap-3 text-xs text-fg-muted">
        {title ? <span className="font-medium">{title}</span> : null}
        <span className="tabular">
          {index + 1} / {questions.length}
        </span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5">
          {QUESTION_TYPE_LABELS[question.type]}
        </span>
      </p>

      <h2 className="mt-4 text-lg leading-relaxed font-medium sm:text-xl">{question.prompt}</h2>

      <ul className="mt-6 space-y-2">
        {question.choices.map((choice) => (
          <li key={choice.id}>
            <button
              type="button"
              onClick={() => select(choice.id)}
              aria-pressed={selected === choice.id}
              className={cn(
                'w-full rounded-xl border px-4 py-4 text-left text-sm leading-relaxed transition-colors',
                selected === choice.id
                  ? 'border-brand bg-brand-soft'
                  : 'border-border hover:bg-surface-muted',
              )}
            >
              {choice.text}
            </button>
          </li>
        ))}
      </ul>

      {index > 0 ? (
        <button
          type="button"
          onClick={() => setIndex(index - 1)}
          className="mt-6 text-sm text-fg-muted hover:text-fg"
        >
          ← 前の設問に戻る
        </button>
      ) : null}
    </div>
  )
}
