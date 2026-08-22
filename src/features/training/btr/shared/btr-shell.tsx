'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { formatRemaining } from './use-countdown'

/**
 * BTR の種目に共通する枠。
 *
 * どの種目も「説明 → 制限時間つきの本番 → スコア」という同じ流れなので、
 * 枠だけをここに置き、中身は種目ごとの部品に任せる。
 */

export function BtrScreen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-5 py-12 sm:px-8">
      {children}
    </main>
  )
}

export interface BtrIntroProps {
  readonly stage: string
  readonly title: string
  readonly children: ReactNode
  readonly startLabel?: string
  readonly onStart: () => void
}

export function BtrIntro({ stage, title, children, startLabel = 'はじめる', onStart }: BtrIntroProps) {
  return (
    <BtrScreen>
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">{stage}</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-fg-muted">{children}</div>
      <Button size="lg" className="mt-8 w-full sm:w-auto" onClick={onStart}>
        {startLabel}
      </Button>
    </BtrScreen>
  )
}

export interface BtrTimerBarProps {
  readonly remainingMs: number
  readonly progress: number
  /** 右側に出す進み具合（「12 / 30」など） */
  readonly detail?: string
}

/**
 * 残り時間の帯。
 *
 * 画面の上に固定する。課題そのものが画面いっぱいに広がるので、
 * 流れの中で残り時間が視野の端に入るようにしておく。
 */
export function BtrTimerBar({ remainingMs, progress, detail }: BtrTimerBarProps) {
  const nearlyOver = remainingMs <= 10_000

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 bg-bg/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-2 sm:px-8">
        <span
          className={cn(
            'tabular text-sm font-medium',
            nearlyOver ? 'text-negative' : 'text-fg-muted',
          )}
        >
          {formatRemaining(remainingMs)}
        </span>
        {detail ? <span className="tabular text-xs text-fg-muted">{detail}</span> : null}
      </div>
      <div className="h-0.5 bg-border">
        <div
          className={cn('h-full transition-[width] duration-100', nearlyOver ? 'bg-negative' : 'bg-brand')}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  )
}

export interface BtrScoreLine {
  readonly label: string
  readonly value: string
}

export interface BtrResultProps {
  readonly title: string
  /** 主スコア。大きく出す。 */
  readonly score: number
  readonly scoreUnit: string
  readonly lines?: readonly BtrScoreLine[]
  readonly note?: string
  readonly nextLabel?: string
  readonly onNext: () => void
}

export function BtrResult({
  title,
  score,
  scoreUnit,
  lines = [],
  note,
  nextLabel = '次へ',
  onNext,
}: BtrResultProps) {
  return (
    <BtrScreen>
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">{title}</p>
      <h2 className="mt-3 flex items-baseline gap-2">
        <span className="tabular text-5xl font-semibold">{score}</span>
        <span className="text-sm text-fg-muted">{scoreUnit}</span>
      </h2>

      {lines.length > 0 ? (
        <dl className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
          {lines.map((line) => (
            <div key={line.label} className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-fg-muted">{line.label}</dt>
              <dd className="tabular text-sm font-medium">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {note ? <p className="mt-4 text-sm leading-relaxed text-fg-muted">{note}</p> : null}

      <Button size="lg" className="mt-8 w-full sm:w-auto" onClick={onNext}>
        {nextLabel}
      </Button>
    </BtrScreen>
  )
}
