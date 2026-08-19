import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Recall' }

export default function RecallPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Next-day Recall</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">今日の Recall はありません</h1>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">
        トレーニングで文章を読むと、翌日にその内容についての Recall がここに表示されます。
        本文は表示されません。覚えている内容を書き出してください。
      </p>
      <Link href="/dashboard" className="mt-8 text-sm text-brand hover:underline">
        ← Dashboard に戻る
      </Link>
    </main>
  )
}
