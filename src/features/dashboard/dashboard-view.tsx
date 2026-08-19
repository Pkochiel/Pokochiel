'use client'

import { ButtonLink } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { SKILL_LABELS, type SkillId, type SkillProfile, type SkillState } from '@/core/types'
import { rankSkillsByNeed } from '@/core/metrics/skill-profile'
import { cn } from '@/lib/cn'
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

const STATE_LABELS: Record<SkillState, string> = {
  unmeasured: '未測定',
  weak: '弱い',
  normal: '標準',
  strong: '強い',
}

const STATE_CLASSES: Record<SkillState, string> = {
  unmeasured: 'bg-surface-muted text-fg-subtle',
  weak: 'bg-accent-soft text-accent',
  normal: 'bg-surface-muted text-fg-muted',
  strong: 'bg-brand-soft text-brand',
}

/** 主要指標としての Skill Profile。弱い順に並べ、まず何を鍛えるかを見せる。 */
function SkillSummary({ profile }: { profile: SkillProfile }) {
  const ranked = rankSkillsByNeed(profile)
  const measured = ranked.filter((m) => m.state !== 'unmeasured').length

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <ul className="space-y-2">
        {ranked.map((measurement) => (
          <li key={measurement.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-fg-muted">{SKILL_LABELS[measurement.id as SkillId]}</span>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  STATE_CLASSES[measurement.state],
                )}
              >
                {STATE_LABELS[measurement.state]}
              </span>
              <span className="tabular w-8 text-right font-medium">
                {measurement.score ?? '—'}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-fg-subtle">
        {measured} / {ranked.length} を測定済み。弱い順に並べています。未測定は弱点とは区別します。
      </p>
    </div>
  )
}

export function DashboardView() {
  const { loading, profile, stats, skillProfile, dueRecallTasks } = useDashboardData()
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

      {skillProfile ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-fg-muted uppercase">
            Skill Profile
          </h2>
          <SkillSummary profile={skillProfile} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-fg-muted uppercase">
          Current Stats
        </h2>
        <StatsGrid stats={stats ?? EMPTY_STATS} />
        {!loading && stats && stats.sampleCounts.cpm > 0 ? (
          <p className="mt-3 text-xs text-fg-subtle">
            直近 {stats.sampleCounts.cpm} 件の実績から算出しています。ERS
            は速度・理解・記憶をまとめた参考値です。
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
