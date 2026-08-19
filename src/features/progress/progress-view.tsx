'use client'

import { useState } from 'react'
import { Card, CardHeader } from '@/components/ui/card'
import { LineChart } from '@/components/charts/line-chart'
import { SkillProfileChart } from '@/components/charts/skill-profile-chart'
import { cn } from '@/lib/cn'
import { useProgressData } from './use-progress-data'

const PERIODS = [7, 30, 90] as const
type PeriodDays = (typeof PERIODS)[number]

export function ProgressView() {
  const [days, setDays] = useState<PeriodDays>(30)
  const { loading, series, skillProfile } = useProgressData(days)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="mt-1 text-sm text-fg-muted">読書速度・理解度・想起の推移</p>
      </header>

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
            {period} days
          </button>
        ))}
      </div>

      {loading || !series ? (
        <p className="text-sm text-fg-muted">読み込んでいます…</p>
      ) : (
        <>
          <Card>
            <CardHeader title="Reading Speed" description="CPM（1分あたりの文字数）" />
            <LineChart
              series={[{ name: 'CPM', points: series.cpm, color: 'var(--chart-1)' }]}
              unit=" 字/分"
            />
          </Card>

          <Card>
            <CardHeader title="Comprehension" description="理解度テストの正答率" />
            <LineChart
              series={[{ name: '理解度', points: series.comprehension, color: 'var(--chart-1)' }]}
              unit="%"
              zeroBased
              maxValue={100}
            />
          </Card>

          <Card>
            <CardHeader
              title="Recall"
              description="直後の想起と、翌日の想起（長期記憶）"
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

          {skillProfile ? (
            <Card>
              <CardHeader
                title="Skill Profile"
                description="9つの認知能力を独立に評価します。未測定は弱点とは区別します。"
              />
              <SkillProfileChart profile={skillProfile} />
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
