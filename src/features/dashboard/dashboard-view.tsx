'use client'

import { PLAN } from '@/core/config/training-config'
import type { PlanBlock, TrainingType } from '@/core/types'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { StatsGrid, type StatsGridValues } from './stats-grid'
import { TodayCard } from './today-card'
import { useDashboardData } from './use-dashboard-data'

const EMPTY_STATS: StatsGridValues = {
  currentCpm: null,
  comprehension: null,
  immediateRecall: null,
  nextDayRecall: null,
  streakDays: 0,
  ers: null,
}

/** TODO(Step 14): generateDailyPlan() の出力に置き換える。 */
function defaultPlanBlocks(totalMinutes: 10 | 20 | 30): PlanBlock[] {
  return Object.entries(PLAN.presets[totalMinutes]).map(([type, minutes], index) => ({
    order: index + 1,
    type: type as TrainingType,
    minutes,
  }))
}

export function DashboardView() {
  const { loading, profile, stats, dueRecallTasks } = useDashboardData()

  const totalMinutes = profile?.preferredDurationMinutes ?? 30
  const blocks = defaultPlanBlocks(totalMinutes)
  const onboarded = profile?.onboardedAt != null && profile.baselineCpm != null

  return (
    <div className="space-y-6">
      {dueRecallTasks.length > 0 ? (
        <Card className="border-accent bg-accent-soft">
          <CardHeader
            title="昨日読んだ文章の Recall があります"
            description="本文は表示しません。覚えている内容を書き出してください。所要 3 分程度。"
          />
          <ButtonLink href="/recall" variant="accent">
            Recall を始める
          </ButtonLink>
        </Card>
      ) : null}

      <TodayCard totalMinutes={totalMinutes} blocks={blocks} />

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-fg-muted uppercase">
          Current Stats
        </h2>
        <StatsGrid stats={stats ?? EMPTY_STATS} />
        {!loading && stats && stats.sampleCounts.cpm > 0 ? (
          <p className="mt-3 text-xs text-fg-subtle">
            直近 {stats.sampleCounts.cpm} 件の実績から算出しています。
          </p>
        ) : null}
      </section>

      {!loading && !onboarded ? (
        <Card>
          <CardHeader
            title="Baseline Test が未実施です"
            description="最初に現在の読書速度・理解度・想起力を測定します。所要 10 分程度。"
          />
          <ButtonLink href="/baseline">Baseline Test を受ける</ButtonLink>
        </Card>
      ) : null}

      {onboarded && profile?.targetCpm ? (
        <Card>
          <CardHeader title="今日の目標速度" description="理解度に応じて自動で調整されます。" />
          <p className="tabular text-2xl font-semibold text-brand">
            {profile.targetCpm}
            <span className="ml-1 text-xs font-normal text-fg-muted">字/分</span>
          </p>
        </Card>
      ) : null}

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
