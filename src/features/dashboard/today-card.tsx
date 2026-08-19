import { ButtonLink } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { PlanBlock } from '@/core/types'

const BLOCK_LABELS: Record<string, string> = {
  warmup: 'ウォームアップ',
  speed_push: 'Speed Push',
  chunk_reading: 'Chunk Reading',
  meaning_flash: 'Meaning Flash',
  structure_reading: 'Structure Reading',
  prediction_reading: 'Prediction Reading',
  variable_speed: 'Variable Speed',
  regression_control: 'Regression Control',
  comprehension: 'Comprehension Test',
  immediate_recall: 'Immediate Recall',
  delayed_recall: '昨日の Recall',
}

export function blockLabel(type: string): string {
  return BLOCK_LABELS[type] ?? type
}

export interface TodayCardProps {
  totalMinutes: number
  blocks: PlanBlock[]
}

/**
 * Dashboard の主役。「今日は何をやればいいのか」を考えさせないため、
 * 単一の CTA と当日の構成だけを示す。
 */
export function TodayCard({ totalMinutes, blocks }: TodayCardProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            Today&apos;s Training
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            今日の{totalMinutes}分トレーニングを開始
          </h1>
        </div>
        <Badge tone="brand">{totalMinutes} min</Badge>
      </div>

      {blocks.length === 0 ? (
        <p className="mt-6 text-sm text-fg-muted">構成を準備しています…</p>
      ) : null}

      <ol className="mt-6 space-y-2">
        {blocks.map((block) => (
          <li
            key={block.order}
            className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3 text-sm"
          >
            <span className="flex items-center gap-3">
              <span className="tabular w-6 text-xs text-fg-subtle">
                {String(block.order).padStart(2, '0')}
              </span>
              <span className="font-medium">{blockLabel(block.type)}</span>
            </span>
            <span className="tabular text-xs text-fg-muted">{block.minutes} 分</span>
          </li>
        ))}
      </ol>

      <ButtonLink href="/training" size="lg" className="mt-6 w-full sm:w-auto">
        トレーニングを開始
      </ButtonLink>
    </section>
  )
}
