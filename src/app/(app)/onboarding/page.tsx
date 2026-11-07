import type { Metadata } from 'next'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = { title: 'はじめに' }

const STEPS = [
  {
    title: '1. Baseline Test',
    body: '未読の文章を1本読み、所要時間から CPM を測定します。読み終えたら Finished を押してください。',
  },
  {
    title: '2. 理解度テスト',
    body: '主張・根拠・因果関係・数値・推論を問う設問に回答します。速度だけでなく理解を測ります。',
  },
  {
    title: '3. Recall Test',
    body: '本文を見ずに、内容を3〜5項目で書き出します。想起できるかどうかが最終的な指標です。',
  },
]

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">はじめに</h1>
        <p className="mt-1 text-sm text-fg-muted">
          最初に現在地を測ります。所要時間は 10 分程度です。
        </p>
      </header>

      {STEPS.map((step) => (
        <Card key={step.title}>
          <h2 className="text-base font-semibold">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.body}</p>
        </Card>
      ))}

      <ButtonLink href="/baseline" size="lg">
        Baseline Test を開始
      </ButtonLink>
    </div>
  )
}
