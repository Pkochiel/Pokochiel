'use client'

import { cn } from '@/lib/cn'
import type { TrainingQuestion } from '@/core/types'

const QUESTION_TYPE_LABELS: Record<TrainingQuestion['type'], string> = {
  main_idea: '主張',
  detail: '詳細',
  cause_effect: '因果関係',
  inference: '推論',
  structure: '構成',
}

export interface QuestionCardProps {
  question: TrainingQuestion
  index: number
  total: number
  selectedChoiceId: string | null
  onSelect: (choiceId: string) => void
  onBack?: () => void
  canGoBack: boolean
}

export function QuestionCard({
  question,
  index,
  total,
  selectedChoiceId,
  onSelect,
  onBack,
  canGoBack,
}: QuestionCardProps) {
  return (
    <div>
      <p className="flex items-center gap-3 text-xs text-fg-muted">
        <span className="tabular">
          {index + 1} / {total}
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
              onClick={() => onSelect(choice.id)}
              aria-pressed={selectedChoiceId === choice.id}
              className={cn(
                'w-full rounded-xl border px-4 py-4 text-left text-sm leading-relaxed transition-colors',
                selectedChoiceId === choice.id
                  ? 'border-brand bg-brand-soft'
                  : 'border-border hover:bg-surface-muted',
              )}
            >
              {choice.text}
            </button>
          </li>
        ))}
      </ul>

      {canGoBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mt-6 text-sm text-fg-muted hover:text-fg"
        >
          ← 前の設問に戻る
        </button>
      ) : null}
    </div>
  )
}
