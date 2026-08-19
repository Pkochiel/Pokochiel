'use client'

import { ButtonLink } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { useDailyPlan } from '@/features/training/use-daily-plan'
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

export function DashboardView() {
  const { loading, profile, stats, dueRecallTasks } = useDashboardData()
  const { plan } = useDailyPlan()

  const totalMinutes = profile?.preferredDurationMinutes ?? 30
  const onboarded = profile?.onboardedAt != null && profile.baselineCpm != null
  const notes = plan?.generatedReason?.notes ?? []

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

      <TodayCard totalMinutes={totalMinutes} blocks={plan?.blocks ?? []} />

      {notes.length > 0 ? (
        <Card>
          <CardHeader title="今日の構成の理由" />
          <ul className="space-y-2 text-sm leading-relaxed text-fg-muted">
            {notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span aria-hidden className="text-brand">
                  ・
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

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
          description="7 / 30 / 90 日の推移と、6軸の能力バランス。"
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
