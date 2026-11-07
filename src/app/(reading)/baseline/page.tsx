import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Baseline Test' }

export default function BaselinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Baseline Test</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        現在の読書速度・理解度・想起力を測定します
      </h1>

      <ol className="mt-8 space-y-3 text-sm leading-relaxed text-fg-muted">
        <li>1. 未読の文章が表示されます。Start を押すと計測が始まります。</li>
        <li>2. 普段どおりの速さで読み、読み終えたら Finished を押してください。</li>
        <li>3. 理解度テスト（8問）に回答します。</li>
        <li>4. 本文を見ずに、内容を3〜5項目で書き出します。</li>
      </ol>

      <p className="mt-6 text-sm text-fg-subtle">
        速く読もうとせず、普段の読み方で測ってください。ここでの値がすべての基準になります。
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/baseline/read" size="lg">
          Start
        </ButtonLink>
        <Link
          href="/dashboard"
          className="inline-flex h-14 items-center justify-center rounded-xl px-7 text-sm text-fg-muted hover:text-fg"
        >
          あとで
        </Link>
      </div>
    </main>
  )
}
