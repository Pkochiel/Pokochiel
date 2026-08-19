import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { blockLabel } from '@/features/dashboard/today-card'
import { PLAN } from '@/core/config/training-config'
import type { TrainingType } from '@/core/types'

export const metadata: Metadata = { title: 'Today’s Training' }

export default function TrainingPage() {
  const preset = PLAN.presets[30]
  const blocks = Object.entries(preset) as [TrainingType, number][]
  const total = blocks.reduce((sum, [, minutes]) => sum + minutes, 0)

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
        Today&apos;s Training
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        今日の{total}分トレーニング
      </h1>

      <ol className="mt-8 space-y-2">
        {blocks.map(([type, minutes], index) => (
          <li
            key={type}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm"
          >
            <span className="flex items-center gap-3">
              <span className="tabular w-6 text-xs text-fg-subtle">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="font-medium">{blockLabel(type)}</span>
            </span>
            <span className="tabular text-xs text-fg-muted">{minutes} 分</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/training/speed_push" size="lg">
          開始する
        </ButtonLink>
        <Link
          href="/dashboard"
          className="inline-flex h-14 items-center justify-center rounded-xl px-7 text-sm text-fg-muted hover:text-fg"
        >
          Dashboard に戻る
        </Link>
      </div>
    </main>
  )
}
