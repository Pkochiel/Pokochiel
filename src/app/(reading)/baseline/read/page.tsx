import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Baseline Test' }

/** TODO(Step 5): 計測付きの読書画面に置き換える。 */
export default function BaselineReadPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">測定用の文章を準備しています</h1>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">
        まもなく利用できるようになります。
      </p>
      <Link href="/baseline" className="mt-8 text-sm text-brand hover:underline">
        ← 戻る
      </Link>
    </main>
  )
}
