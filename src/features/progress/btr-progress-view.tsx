'use client'

import type { BtrTrend, ReadingSpeedSummary } from '@/core/metrics/btr-progress'
import { PACED_READING } from '@/core/training/btr/paced-reading'
import { BTR_STAGE_LABELS, btrExercise, type BtrStage } from '@/core/training/btr/exercises'
import { Sparkline } from '@/components/charts/sparkline'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { cn } from '@/lib/cn'
import { useBtrProgress } from './use-btr-progress'

/**
 * 種目ごとの推移（BTRメソッド）。
 *
 * 総合点をひとつ出すのではなく、種目ごとの数字を並べる。
 * 受講記録がそういう形だからであり、まとめてしまうと伸びている種目と
 * 落ちている種目が打ち消し合って、どちらも見えなくなる。
 */

const STAGES: BtrStage[] = ['prepare', 'field', 'focus', 'reading']

const DIRECTION_MARKS: Record<BtrTrend['direction'], { mark: string; label: string }> = {
  up: { mark: '▲', label: '伸びています' },
  down: { mark: '▼', label: '落ちています' },
  flat: { mark: '—', label: '横ばいです' },
  unknown: { mark: '', label: '' },
}

export function BtrProgressView() {
  const { loading, trends, reading } = useBtrProgress()

  if (loading) return <p className="text-sm text-fg-muted">読み込んでいます…</p>

  if (trends.length === 0) {
    return (
      <div className="rounded-2xl border border-border border-dashed p-6">
        <p className="text-sm leading-relaxed text-fg-muted">
          まだ記録がありません。1回でも通すと、種目ごとの数字がここに並びます。
        </p>
        <ButtonLink href="/btr" className="mt-4 w-full sm:w-auto">
          トレーニングへ
        </ButtonLink>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {reading ? <ReadingCard reading={reading} /> : null}

      {STAGES.map((stage) => {
        const rows = trends.filter((trend) => btrExercise(trend.exercise).stage === stage)
        if (rows.length === 0) return null

        return (
          <section key={stage}>
            <h3 className="text-sm font-medium text-fg-muted">{BTR_STAGE_LABELS[stage]}</h3>
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
              {rows.map((trend) => (
                <li
                  key={`${trend.exercise}-${trend.variant ?? ''}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium">{trend.name}</span>
                      {trend.levelLabel ? (
                        <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">
                          {trend.levelLabel}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      {trend.attempts} 回
                      {trend.best !== null
                        ? `・${trend.lowerIsBetter ? '最少' : '最高'} ${trend.best}`
                        : ''}
                      {trend.lowerIsBetter ? '（少ないほうがよい）' : ''}
                    </p>
                  </div>

                  <Sparkline
                    values={trend.points.map((point) => point.score)}
                    lowerIsBetter={trend.lowerIsBetter}
                    label={`${trend.name} の推移`}
                    className={cn(
                      'hidden shrink-0 sm:block',
                      trend.direction === 'down' ? 'text-negative' : 'text-brand',
                    )}
                  />

                  <div className="w-16 shrink-0 text-right">
                    <p className="tabular text-lg font-semibold">{trend.latest ?? '—'}</p>
                    {trend.direction !== 'unknown' ? (
                      <p
                        className={cn(
                          'text-[11px]',
                          trend.direction === 'up'
                            ? 'text-positive'
                            : trend.direction === 'down'
                              ? 'text-negative'
                              : 'text-fg-subtle',
                        )}
                        title={DIRECTION_MARKS[trend.direction].label}
                      >
                        {DIRECTION_MARKS[trend.direction].mark}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <p className="text-xs leading-relaxed text-fg-muted">
        向きは直近3回と、その前の3回の平均を比べています。
        1回前とだけ比べると、その日の調子で上下して意味を成さないためです。
      </p>
    </div>
  )
}

/**
 * 読書の伸びだけは別に大きく出す。
 *
 * 「入会時の3倍」がこのアプリの目標そのものなので、
 * 他の種目と同じ行に並べると埋もれてしまう。
 */
function ReadingCard({ reading }: { reading: ReadingSpeedSummary }) {
  const { progress, latestPacedCpm, baselineCpm, normal } = reading
  const latestNormal = normal[normal.length - 1]?.score ?? null

  return (
    <Card>
      <CardHeader
        title="読書の伸び"
        description={`入会時の ${PACED_READING.targetMultiplier} 倍が目標。倍速読書の記録だけで測ります。`}
      />

      {progress === null ? (
        <p className="text-sm leading-relaxed text-fg-muted">
          {baselineCpm === null
            ? '入会時の速度（Baseline）がまだありません。測ると、ここに何倍になったかが出ます。'
            : '倍速読書の記録がまだありません。'}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="tabular text-4xl font-semibold">{progress.multiplier}</span>
            <span className="text-sm text-fg-muted">倍</span>
          </div>
          <ProgressBar value={progress.towardTarget} className="mt-4" />
          <dl className="mt-5 divide-y divide-border rounded-xl border border-border">
            <Row label="入会時" value={`${progress.baselineCpm} 字/分`} />
            <Row label="いまの倍速読書" value={`${latestPacedCpm} 字/分`} />
            {latestNormal !== null ? (
              <Row label="いまの普通読書" value={`${latestNormal} 字/分`} />
            ) : null}
          </dl>
          {progress.reachedTarget ? (
            <p className="mt-4 text-sm text-positive">
              目標の {PACED_READING.targetMultiplier} 倍に届いています。
            </p>
          ) : null}
        </>
      )}
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="tabular text-sm font-medium">{value}</dd>
    </div>
  )
}
