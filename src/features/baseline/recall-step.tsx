'use client'

import { Button } from '@/components/ui/button'
import { RECALL } from '@/core/config/training-config'
import { evaluateRecall } from '@/core/metrics/recall'
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

export interface RecallReviewProps {
  recallText: string
  keyPoints: readonly string[]
  recalledIndexes: readonly number[]
  onToggleKeyPoint: (index: number) => void
  selfAssessment: number | null
  onSelfAssess: (score: number) => void
  onSubmit: () => void
}

/**
 * 想起の照合。
 *
 * 主要な指標は「Key Points のうち、いくつを実際に思い出せていたか」。
 * 自己評価だけに依存すると、模範解答を見た後の印象で点が動くため、
 * まず項目ごとにチェックさせ、自己評価は補助として併せて記録する。
 */
export function RecallReview({
  recallText,
  keyPoints,
  recalledIndexes,
  onToggleKeyPoint,
  selfAssessment,
  onSelfAssess,
  onSubmit,
}: RecallReviewProps) {
  const evaluation = evaluateRecall({
    keyPoints,
    recalledKeyPointIndexes: recalledIndexes,
    selfAssessment,
    text: recallText,
  })

  return (
    <div>
      <h2 className="text-lg font-medium sm:text-xl">思い出せていた項目を選んでください</h2>
      <p className="mt-3 text-sm text-fg-muted">
        書いた内容と照らして、実際に触れられていた項目にチェックを入れます。
        書き漏らしたものは選ばないでください。
      </p>

      <ul className="mt-5 space-y-2">
        {keyPoints.map((point, index) => {
          const selected = recalledIndexes.includes(index)
          return (
            <li key={point}>
              <button
                type="button"
                onClick={() => onToggleKeyPoint(index)}
                aria-pressed={selected}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors',
                  selected ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-muted',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px]',
                    selected ? 'border-brand bg-brand text-brand-fg' : 'border-border',
                  )}
                >
                  {selected ? '✓' : ''}
                </span>
                <span>{point}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="tabular mt-4 text-sm text-fg-muted">
        思い出せた項目:{' '}
        <span className="font-medium text-fg">
          {evaluation.recalledCount} / {evaluation.totalCount}
        </span>
        <span className="ml-2 text-xs text-fg-subtle">（Recall Score {evaluation.score}）</span>
      </p>

      <section className="mt-5 rounded-xl border border-border bg-surface-muted p-4">
        <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
          あなたの再現
        </h3>
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{recallText}</p>
      </section>

      <div className="mt-6">
        <h3 className="text-sm font-medium">全体としての手応えは？</h3>
        <p className="mt-1 text-xs text-fg-subtle">
          補助的な指標です。スコアは上のチェックから算出します。
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {RECALL.selfAssessmentSteps.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => onSelfAssess(step)}
              aria-pressed={selfAssessment === step}
              className={cn(
                'tabular rounded-xl border py-3 text-sm font-medium transition-colors',
                selfAssessment === step
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-border',
              )}
            >
              {step}%
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={onSubmit}
        disabled={selfAssessment === null}
        size="lg"
        className="mt-6 w-full sm:w-auto"
      >
        次へ
      </Button>
    </div>
  )
}
