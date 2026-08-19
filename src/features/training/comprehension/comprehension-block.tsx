'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { scoreComprehension } from '@/core/metrics/comprehension'
import type { AnswerRecord } from '@/core/metrics/comprehension'
import { cn } from '@/lib/cn'
import { QuestionRunner } from '../shared/question-runner'
import type { TrainingBlockProps } from '../shared/types'

/**
 * Training 08: Comprehension Test
 *
 * 読書後に必ず理解度を測る。5種の設問タイプを含み、暗記だけでは解けないようにする。
 * 回答後に解説を見せ、どこで取り違えたのかを確認できるようにする。
 */
export function ComprehensionBlock({ passage, onComplete }: TrainingBlockProps) {
  const [answers, setAnswers] = useState<AnswerRecord[] | null>(null)

  if (!answers) {
    return (
      <Centered>
        <QuestionRunner
          questions={passage.questions}
          title="Comprehension Test"
          onComplete={setAnswers}
        />
      </Centered>
    )
  }

  const result = scoreComprehension(passage.questions, answers)

  return (
    <Centered>
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
        Comprehension
      </p>
      <h2 className="mt-3 flex items-baseline gap-2 text-3xl font-semibold">
        <span className="tabular">{result.score}</span>
        <span className="text-sm font-normal text-fg-muted">
          / 100（{result.correctCount} / {result.total} 問正解）
        </span>
      </h2>

      <ul className="mt-6 space-y-3">
        {passage.questions.map((question) => {
          const detail = result.details.find((d) => d.questionId === question.id)
          const chosen = question.choices.find((c) => c.id === detail?.selectedChoiceId)
          const correct = question.choices.find((c) => c.id === question.correctChoiceId)
          return (
            <li key={question.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium">{question.prompt}</p>
              <p
                className={cn(
                  'mt-2 text-xs',
                  detail?.correct ? 'text-positive' : 'text-negative',
                )}
              >
                {detail?.correct ? '正解' : `あなたの回答: ${chosen?.text ?? '未回答'}`}
              </p>
              {!detail?.correct ? (
                <p className="mt-1 text-xs text-fg-muted">正解: {correct?.text}</p>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-fg-subtle">{question.explanation}</p>
            </li>
          )
        })}
      </ul>

      <Button
        size="lg"
        className="mt-6 w-full sm:w-auto"
        onClick={() =>
          onComplete({ comprehensionScore: result.score, questionCount: result.total })
        }
      >
        次へ
      </Button>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      {children}
    </main>
  )
}
