import type { Metadata } from 'next'
import { TodayCard } from '@/features/dashboard/today-card'
import { StatsGrid, type DashboardStats } from '@/features/dashboard/stats-grid'
import { Card, CardHeader } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import { PLAN } from '@/core/config/training-config'
import type { PlanBlock, TrainingType } from '@/core/types'

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * TODO(Step 11): 実データを Repository から取得する。
 * 現時点は骨格確認のためのプレースホルダ値。
 */
const PLACEHOLDER_STATS: DashboardStats = {
  currentCpm: null,
  comprehension: null,
  immediateRecall: null,
  nextDayRecall: null,
  streakDays: 0,
  ers: null,
}

/** TODO(Step 14): generateDailyPlan() の出力に置き換える。 */
function defaultPlanBlocks(): PlanBlock[] {
  const preset = PLAN.presets[30]
  return Object.entries(preset).map(([type, minutes], index) => ({
    order: index + 1,
    type: type as TrainingType,
    minutes,
  }))
}

export default function DashboardPage() {
  const blocks = defaultPlanBlocks()
  const totalMinutes = blocks.reduce((sum, b) => sum + b.minutes, 0)

  return (
    <div className="space-y-6">
      <TodayCard totalMinutes={totalMinutes} blocks={blocks} />

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-fg-muted uppercase">
          Current Stats
        </h2>
        <StatsGrid stats={PLACEHOLDER_STATS} />
      </section>

      <Card>
        <CardHeader
          title="Baseline Test が未実施です"
          description="最初に現在の読書速度・理解度・想起力を測定します。所要 10 分程度。"
        />
        <ButtonLink href="/baseline">Baseline Test を受ける</ButtonLink>
      </Card>

      <Card>
        <CardHeader
          title="Progress"
          description="7 / 30 / 90 日の推移を確認できます。"
          action={
            <ButtonLink href="/progress" variant="secondary" size="sm">
              開く
            </ButtonLink>
          }
        />
        <p className="text-sm text-fg-muted">
          トレーニングを実施すると、読書速度・理解度・想起の推移がここに蓄積されます。
        </p>
      </Card>
    </div>
  )
}
