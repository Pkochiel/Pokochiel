import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = { title: 'ログイン' }

/**
 * Phase 1 はローカル保存のみで動作するため、ログインは必須ではない。
 * Supabase Auth の接続は Step 13 で行う。
 */
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">ログイン</h1>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">
        現在はアカウントなしで利用できます。トレーニング結果はこの端末に保存されます。
        アカウント連携は後日提供し、既存の記録はそのまま引き継げます。
      </p>
      <ButtonLink href="/dashboard" size="lg" className="mt-8">
        アカウントなしで始める
      </ButtonLink>
      <Link href="/" className="mt-6 text-sm text-fg-muted hover:text-fg">
        ← トップへ
      </Link>
    </main>
  )
}
