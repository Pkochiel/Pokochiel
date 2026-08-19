import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { Stat } from '@/components/ui/stat'
import { SkillProfileChart } from '@/components/charts/skill-profile-chart'
import { calculateErs } from '@/core/metrics/ers'
import { formatScore } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { SpeedDirection } from '@/core/adaptive/speed'
import type { FeedbackMessage } from '@/core/feedback/feedback'
import type { SkillProfile } from '@/core/types'

export interface SessionSummary {
  cpm: number | null
  comprehension: number | null
  immediateRecall: number | null
  nextTargetCpm: number
  direction: SpeedDirection
  reason: string
  blocksCompleted: number
  /** 主要指標。ERS ではなくこちらを先に見せる。 */
  skillProfile: SkillProfile
  feedback: readonly FeedbackMessage[]
}

const DIRECTION_LABELS: Record<SpeedDirection, string> = {
  up: '上げます',
  hold: '維持します',
  down: '戻します',
}

export function SessionResult({ summary }: { summary: SessionSummary }) {
  const ers = calculateErs({
    cpm: summary.cpm,
    comprehensionScore: summary.comprehension,
    recallScore: summary.immediateRecall,
  })

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Session Result</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        今日のトレーニングが終わりました
      </h1>
      <p className="mt-2 text-sm text-fg-muted">{summary.blocksCompleted} 個のトレーニングを実施</p>

      <ul className="mt-8 space-y-3">
        {summary.feedback.map((message) => (
          <li
            key={message.text}
            className={cn(
              'rounded-2xl border bg-surface p-5 text-sm leading-relaxed',
              message.tone === 'positive'
                ? 'border-positive'
                : message.tone === 'caution'
                  ? 'border-accent'
                  : 'border-border',
            )}
          >
            {message.text}
          </li>
        ))}
      </ul>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Skill Profile</h2>
        <p className="mt-1 text-xs text-fg-subtle">
          9つの能力を独立に評価します。これが主要な指標です。
        </p>
        <div className="mt-4">
          <SkillProfileChart profile={summary.skillProfile} />
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat label="Reading Speed" value={formatScore(summary.cpm)} unit="字/分" tone="brand" />
        <Stat label="Comprehension" value={formatScore(summary.comprehension, '%')} />
        <Stat label="Immediate Recall" value={formatScore(summary.immediateRecall, '%')} />
        <Stat label="ERS" value={formatScore(ers)} hint="速度 × 理解 × 想起（参考値）" />
      </div>
      <p className="mt-2 text-xs text-fg-subtle">
        ERS は速度・理解・記憶を一つにまとめた参考値です。速度が高いほど大きく出るため、
        単独では能力の総合指標になりません。
      </p>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">
          次回の目標速度を{DIRECTION_LABELS[summary.direction]}
        </h2>
        <p className="tabular mt-2 text-2xl font-semibold text-brand">
          {summary.nextTargetCpm}
          <span className="ml-1 text-xs font-normal text-fg-muted">字/分</span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{summary.reason}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-accent-soft p-5">
        <h2 className="text-sm font-semibold">明日、今日読んだ文章について質問します</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          本文は表示しません。覚えている内容を書き出してもらいます。長期記憶の指標になります。
        </p>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/dashboard" size="lg">
          Dashboard へ
        </ButtonLink>
        <Link
          href="/progress"
          className="inline-flex h-14 items-center justify-center rounded-xl px-7 text-sm text-fg-muted hover:text-fg"
        >
          推移を見る
        </Link>
      </div>
    </main>
  )
}
