'use client'

import { Button } from '@/components/ui/button'
import { RECALL } from '@/core/config/training-config'
import { cn } from '@/lib/cn'

export interface RecallInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}

/**
 * 本文を完全に隠した状態で内容を再現させる。
 * 模範解答（Key Points）は、この入力を確定するまで表示しない。
 */
export function RecallInput({ value, onChange, onSubmit }: RecallInputProps) {
  return (
    <div>
      <h2 className="text-lg font-medium sm:text-xl">
        今読んだ内容を、見ずに3〜5項目で再現してください
      </h2>
      <p className="mt-3 text-sm text-fg-muted">
        完全でなくて構いません。思い出せた範囲を、1行に1項目で書いてください。
      </p>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={8}
        autoFocus
        placeholder={'例）\n・主張は◯◯である\n・根拠として△△が挙げられていた\n・最後に□□という限定があった'}
        className="mt-5 w-full resize-y rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed"
      />

      <Button
        onClick={onSubmit}
        disabled={value.trim().length === 0}
        size="lg"
        className="mt-5 w-full sm:w-auto"
      >
        入力を確定する
      </Button>
    </div>
  )
}

export interface RecallScoreProps {
  recallText: string
  keyPoints: readonly string[]
  score: number | null
  onSelect: (score: number) => void
  onSubmit: () => void
}

export function RecallScore({
  recallText,
  keyPoints,
  score,
  onSelect,
  onSubmit,
}: RecallScoreProps) {
  return (
    <div>
      <h2 className="text-lg font-medium sm:text-xl">どの程度再現できていましたか</h2>

      <section className="mt-5 rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Key Points</h3>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed">
          {keyPoints.map((point) => (
            <li key={point} className="flex gap-2">
              <span aria-hidden className="text-brand">
                ・
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-surface-muted p-4">
        <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
          あなたの再現
        </h3>
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{recallText}</p>
      </section>

      <div className="mt-6 grid grid-cols-5 gap-2">
        {RECALL.selfAssessmentSteps.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onSelect(step)}
            aria-pressed={score === step}
            className={cn(
              'tabular rounded-xl border py-3 text-sm font-medium transition-colors',
              score === step ? 'border-brand bg-brand-soft text-brand' : 'border-border',
            )}
          >
            {step}%
          </button>
        ))}
      </div>

      <Button
        onClick={onSubmit}
        disabled={score === null}
        size="lg"
        className="mt-6 w-full sm:w-auto"
      >
        結果を見る
      </Button>
    </div>
  )
}
