'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RECALL } from '@/core/config/training-config'
import { formatLocalDate } from '@/core/util/date'
import type { RecallTask, TrainingPassage } from '@/core/types'
import { cn } from '@/lib/cn'
import { getPassageById } from '@/data/content'
import { getRepository, resolveTimezone } from '@/data/repositories'

/**
 * 想起を終えたときに返すもの。
 *
 * 翌日の想起は単独の画面としてしか使っていないので、
 * 返すのは書き出した本文だけでよい。
 */
export interface RecallOutcome {
  readonly recallText?: string | null
}


type Phase = 'loading' | 'empty' | 'input' | 'score'

export interface DelayedRecallBlockProps {
  onComplete?: (outcome: RecallOutcome) => void
}

/**
 * Training 10: Next-day Recall
 *
 * 前日に読んだ文章について、本文を見せずに問う。
 * ここで得られる値を長期記憶の指標として保存する。
 */
export function DelayedRecallBlock({ onComplete }: DelayedRecallBlockProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [task, setTask] = useState<RecallTask | null>(null)
  const [passage, setPassage] = useState<TrainingPassage | null>(null)
  const [text, setText] = useState('')
  const [score, setScore] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const today = formatLocalDate(new Date(), resolveTimezone())
      const due = await getRepository().listDueRecallTasks(today)
      const first = due[0]
      if (cancelled) return
      if (!first) {
        setPhase('empty')
        return
      }
      setTask(first)
      setPassage(getPassageById(first.passageId))
      setPhase('input')
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (phase === 'loading') {
    return <Centered><p className="text-sm text-fg-muted">読み込んでいます…</p></Centered>
  }

  if (phase === 'empty') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
          Next-day Recall
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">今日の Recall はありません</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          トレーニングで文章を読むと、翌日にその内容についての Recall がここに表示されます。
        </p>
        {onComplete ? (
          <Button className="mt-8 w-full sm:w-auto" onClick={() => onComplete({})}>
            次へ進む
          </Button>
        ) : (
          <Link href="/dashboard" className="mt-8 text-sm text-brand hover:underline">
            ← Dashboard に戻る
          </Link>
        )}
      </Centered>
    )
  }

  if (phase === 'input') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
          Next-day Recall
        </p>
        <h1 className="mt-3 text-lg leading-relaxed font-medium sm:text-xl">
          昨日読んだ「{passage?.title ?? 'この文章'}」について、
          <br />
          覚えていることを書いてください
        </h1>
        <p className="mt-3 text-sm text-fg-muted">
          本文は表示しません。思い出せた範囲で構いません。
        </p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={8}
          autoFocus
          className="mt-5 w-full resize-y rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed"
        />
        <Button
          size="lg"
          className="mt-5 w-full sm:w-auto"
          disabled={text.trim().length === 0}
          onClick={() => setPhase('score')}
        >
          入力を確定する
        </Button>
      </Centered>
    )
  }

  return (
    <Centered>
      <h2 className="text-lg font-medium sm:text-xl">どの程度覚えていましたか</h2>

      <section className="mt-5 rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Key Points</h3>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed">
          {(passage?.keyPoints ?? []).map((point) => (
            <li key={point} className="flex gap-2">
              <span aria-hidden className="text-accent">
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
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </section>

      <div className="mt-6 grid grid-cols-5 gap-2">
        {RECALL.selfAssessmentSteps.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => setScore(step)}
            aria-pressed={score === step}
            className={cn(
              'tabular rounded-xl border py-3 text-sm font-medium transition-colors',
              score === step ? 'border-accent bg-accent-soft text-accent' : 'border-border',
            )}
          >
            {step}%
          </button>
        ))}
      </div>

      <Button
        size="lg"
        className="mt-6 w-full sm:w-auto"
        disabled={score === null}
        onClick={() => {
          if (score === null || !task) return
          void getRepository()
            .completeRecallTask(task.id, {
              recallScore: score,
              recallText: text,
              completedAt: new Date().toISOString(),
            })
            .then(() => {
              // 翌日想起のスコアは recall_tasks 側に保存される
              onComplete?.({ recallText: text })
            })
          if (!onComplete) router.push('/dashboard')
        }}
      >
        {onComplete ? '次へ進む' : '完了'}
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
