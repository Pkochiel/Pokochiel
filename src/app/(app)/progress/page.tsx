import type { Metadata } from 'next'
import { Card, CardHeader } from '@/components/ui/card'
import { PeriodTabs } from '@/features/progress/period-tabs'

export const metadata: Metadata = { title: 'Progress' }

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="mt-1 text-sm text-fg-muted">読書速度・理解度・想起の推移</p>
      </header>

      <PeriodTabs />

      <Card>
        <CardHeader title="Reading Speed" description="CPM（1分あたりの文字数）" />
        <EmptyState />
      </Card>

      <Card>
        <CardHeader title="Comprehension" description="理解度テストの正答率" />
        <EmptyState />
      </Card>

      <Card>
        <CardHeader title="Recall" description="直後想起と翌日想起" />
        <EmptyState />
      </Card>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
      <p className="px-6 text-center text-sm text-fg-subtle">
        まだデータがありません。トレーニングを実施すると推移が表示されます。
      </p>
    </div>
  )
}
