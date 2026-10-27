'use client'

import { BTR_SESSION_MINUTES } from '@/core/planner/btr-session'
import { btrExercise } from '@/core/training/btr/exercises'
import { PACED_READING } from '@/core/training/btr/paced-reading'
import type { BtrExercise } from '@/core/training/btr/exercises'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { useDashboardData } from './use-dashboard-data'

/**
 * 開いたときに見えるもの。
 *
 * 「今日やったか」「続いているか」「入会時の何倍か」の3つに絞る。
 * 種目ごとの数字は推移の画面で見るものなので、ここには並べない。
 * 入口に全部を出すと、いちばん大事な「今日やる」が埋もれる。
 */

export function DashboardView() {
  const { loading, profile, today, streakDays, latest, reading, dueRecallTasks } =
    useDashboardData()

  const doneToday = latest !== null && latest.date === today
  const onboarded = profile?.baselineCpm != null

  return (
    <div className="space-y-6">
      {dueRecallTasks.length > 0 ? (
        <Card className="border-accent bg-accent-soft">
          <CardHeader
            title="昨日読んだ文章の想起があります"
            description="本文は出しません。覚えている内容を書き出してください。3分ほど。"
          />
          <ButtonLink href="/recall" variant="accent">
            想起を始める
          </ButtonLink>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={doneToday ? '今日はもう済んでいます' : '今日のトレーニング'}
          description={
            doneToday
              ? 'もう一度やっても構いません。記録はどちらも残ります。'
              : `${BTR_SESSION_MINUTES.join(' / ')} 分から選べます。`
          }
        />
        <ButtonLink href="/btr" variant={doneToday ? 'secondary' : 'primary'}>
          {doneToday ? 'もう一度やる' : 'はじめる'}
        </ButtonLink>

        {streakDays > 0 ? (
          <p className="mt-4 text-sm text-fg-muted">
            <span className="tabular font-medium text-fg">{streakDays}</span> 日続いています。
          </p>
        ) : null}
      </Card>

      {reading?.progress ? (
        <Card>
          <CardHeader
            title="読書の伸び"
            description={`入会時の ${PACED_READING.targetMultiplier} 倍が目標。倍速読書の記録だけで測ります。`}
            action={
              <ButtonLink href="/progress" variant="secondary" size="sm">
                推移を見る
              </ButtonLink>
            }
          />
          <div className="flex items-baseline gap-2">
            <span className="tabular text-4xl font-semibold">{reading.progress.multiplier}</span>
            <span className="text-sm text-fg-muted">倍</span>
          </div>
          <ProgressBar value={reading.progress.towardTarget} className="mt-4" />
        </Card>
      ) : null}

      {latest ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-fg-muted">
            直近の記録（{latest.date}）
          </h2>
          <dl className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {latest.records.map((record, index) => (
              <div
                key={`${record.exercise}-${record.variant ?? ''}-${index}`}
                className="flex items-center justify-between px-4 py-3"
              >
                <dt className="text-sm text-fg-muted">{nameOf(record.exercise)}</dt>
                <dd className="tabular text-sm font-medium">{record.score}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {!loading && !onboarded ? (
        <Card>
          <CardHeader
            title="入会時の速度がまだありません"
            description="はじめに1回だけ測ります。ここが「3倍」の分母になります。10分ほど。"
          />
          <ButtonLink href="/baseline">測る</ButtonLink>
        </Card>
      ) : null}
    </div>
  )
}

/** 一覧にない種目（消した種目の記録）は id のまま出す。落とさない。 */
function nameOf(exercise: string): string {
  try {
    return btrExercise(exercise as BtrExercise).name
  } catch {
    return exercise
  }
}
