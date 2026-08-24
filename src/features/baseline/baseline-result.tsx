import Link from 'next/link'
import { Stat } from '@/components/ui/stat'
import { ButtonLink } from '@/components/ui/button'
import { calculateErs } from '@/core/metrics/ers'
import type { CpmInvalidReason } from '@/core/metrics/cpm'
import type { BaselineProfile } from '@/core/types'
import { formatScore } from '@/lib/format'

/** 無効な計測は理由を分けて伝える。「短すぎる」と「速すぎる」では次の行動が違うため。 */
const INVALID_MESSAGES: Record<CpmInvalidReason, string> = {
  too_short:
    '読書時間が短すぎるため、この測定は基準値として保存していません。落ち着いて読める状態で、もう一度実施してください。',
  implausible:
    '本文の分量に対して読了までが速すぎるため、基準値として保存していません。飛ばさずに最後まで読んだうえで、もう一度実施してください。',
  no_elapsed:
    '読書時間を計測できませんでした。もう一度実施してください。',
}

export interface BaselineResultProps {
  cpm: number
  valid: boolean
  invalidReason: CpmInvalidReason | null
  comprehensionScore: number | null
  recallScore: number
  targetCpm: number
  /** 複数回の測定をまとめた現在地 */
  profile: BaselineProfile
}

export function BaselineResult({
  cpm,
  valid,
  invalidReason,
  comprehensionScore,
  recallScore,
  targetCpm,
  profile,
}: BaselineResultProps) {
  const ers = calculateErs({ cpm, comprehensionScore, recallScore })

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Baseline</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        現在地を測定しました
      </h1>

      {!valid ? (
        <p className="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-sm leading-relaxed text-fg-muted">
          {INVALID_MESSAGES[invalidReason ?? 'no_elapsed']}
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-3">
        <Stat label="Reading Speed" value={formatScore(cpm)} unit="字/分" tone="brand" />
        <Stat label="Comprehension" value={formatScore(comprehensionScore, '%')} />
        <Stat label="Immediate Recall" value={formatScore(recallScore, '%')} />
        <Stat label="ERS" value={formatScore(ers)} hint="速度 × 理解 × 想起" />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">理解の内訳</h2>
        <p className="mt-2 text-xs text-fg-subtle">
          速度だけでなく、何を掴めていたかを分けて記録します。
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-fg-muted">主張の把握</dt>
            <dd className="tabular mt-1 font-medium">{formatScore(profile.mainIdea, '%')}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">因果の把握</dt>
            <dd className="tabular mt-1 font-medium">{formatScore(profile.causeEffect, '%')}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">構成の把握</dt>
            <dd className="tabular mt-1 font-medium">{formatScore(profile.structure, '%')}</dd>
          </div>
        </dl>
        {profile.attempts > 1 ? (
          <p className="mt-3 text-xs text-fg-subtle">
            {profile.attempts} 回の測定から算出しています（CPM は中央値）。
          </p>
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">明日からの目標速度</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Speed Push は <span className="tabular font-medium text-fg">{targetCpm} 字/分</span>{' '}
          から始めます。理解度が保てていれば少しずつ上げ、下がれば戻します。
          極端な速度は目指しません。
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-accent-soft p-5">
        <h2 className="text-sm font-semibold">明日、同じ文章について質問します</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          本文は表示しません。覚えている内容を書き出してもらいます。
          これが長期記憶の指標になります。
        </p>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/dashboard" size="lg">
          Dashboard へ
        </ButtonLink>
        <Link
          href="/btr"
          className="inline-flex h-14 items-center justify-center rounded-xl px-7 text-sm text-fg-muted hover:text-fg"
        >
          今日のトレーニングを始める
        </Link>
      </div>
    </div>
  )
}
