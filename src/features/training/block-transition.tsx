'use client'

import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import type { FeedbackMessage } from '@/core/feedback/feedback'
import { cn } from '@/lib/cn'
import { TRAINING_LABELS } from './shared/types'
import type { TrainingType } from '@/core/types'

const TONE_CLASSES = {
  positive: 'border-positive',
  caution: 'border-accent',
  neutral: 'border-border',
} as const

export interface BlockTransitionProps {
  completed: TrainingType
  next: TrainingType | null
  index: number
  total: number
  messages: readonly FeedbackMessage[]
  onContinue: () => void
}

/**
 * トレーニングとトレーニングの間に挟む画面。
 *
 * メニューへ戻らせず、そのまま次へ進めるための導線であると同時に、
 * 「今の結果から何が言えるか」を1〜2文で返す場所でもある。
 */
export function BlockTransition({
  completed,
  next,
  index,
  total,
  messages,
  onContinue,
}: BlockTransitionProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      <ProgressBar
        value={index / total}
        className="fixed inset-x-0 top-0 h-1 rounded-none"
        label="セッションの進捗"
      />

      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
        {TRAINING_LABELS[completed]} 完了
      </p>
      <p className="tabular mt-2 text-xs text-fg-subtle">
        {index} / {total}
      </p>

      <ul className="mt-6 space-y-3">
        {messages.map((message) => (
          <li
            key={message.text}
            className={cn(
              'rounded-2xl border bg-surface p-5 text-sm leading-relaxed',
              TONE_CLASSES[message.tone],
            )}
          >
            {message.text}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {next ? (
          <>
            <p className="text-sm text-fg-muted">
              次は <span className="font-medium text-fg">{TRAINING_LABELS[next]}</span> です。
            </p>
            <Button size="lg" className="mt-3 w-full sm:w-auto" onClick={onContinue}>
              続ける
            </Button>
          </>
        ) : (
          <Button size="lg" className="w-full sm:w-auto" onClick={onContinue}>
            結果を見る
          </Button>
        )}
      </div>
    </main>
  )
}
