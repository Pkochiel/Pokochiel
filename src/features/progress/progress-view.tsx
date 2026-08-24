'use client'

import { useState } from 'react'
import { Card, CardHeader } from '@/components/ui/card'
import { LineChart } from '@/components/charts/line-chart'
import { cn } from '@/lib/cn'
import { BtrProgressView } from './btr-progress-view'
import { useProgressData } from './use-progress-data'

/**
 * 推移。
 *
 * 主役は種目ごとの数字の並び（BTRメソッドの受講記録がその形）。
 * 翌日の想起だけは BTR に対応する種目がないが、記憶の定着を見る指標として
 * 残してある。ただし補助であって、主役ではない。
 */

const PERIODS = [7, 30, 90] as const
type PeriodDays = (typeof PERIODS)[number]

export function ProgressView() {
  const [days, setDays] = useState<PeriodDays>(30)
  const { loading, series } = useProgressData(days)

  const hasRecall = (series?.delayedRecall ?? []).some((point) => point.value !== null)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">推移</h1>
        <p className="mt-1 text-sm text-fg-muted">種目ごとの数字を並べて見ます</p>
      </header>

      <BtrProgressView />

      {loading || !series || !hasRecall ? null : (
        <section className="space-y-4">
          <div
            role="tablist"
            aria-label="表示期間"
            className="inline-flex rounded-xl bg-surface-muted p-1"
          >
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                role="tab"
                aria-selected={days === period}
                onClick={() => setDays(period)}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-sm transition-colors',
                  days === period ? 'bg-surface font-medium text-fg shadow-sm' : 'text-fg-muted',
                )}
              >
                {period} 日
              </button>
            ))}
          </div>

          <Card>
            <CardHeader
              title="翌日の想起"
              description="読んだ翌日にどれだけ思い出せたか。BTR に対応する種目はありませんが、記憶の定着を見る補助として残しています。"
            />
            <LineChart
              series={[
                { name: '直後', points: series.immediateRecall, color: 'var(--chart-1)' },
                { name: '翌日', points: series.delayedRecall, color: 'var(--chart-2)' },
              ]}
              unit="%"
              zeroBased
              maxValue={100}
            />
          </Card>
        </section>
      )}
    </div>
  )
}
