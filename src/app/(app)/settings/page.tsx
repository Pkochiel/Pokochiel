import type { Metadata } from 'next'
import { Card, CardHeader } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Settings' }

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">トレーニング時間と表示の設定</p>
      </header>

      <Card>
        <CardHeader title="1日のトレーニング時間" description="10 / 20 / 30 分から選択します。" />
        <p className="text-sm text-fg-muted">Baseline Test の完了後に設定できます。</p>
      </Card>

      <Card>
        <CardHeader title="表示" description="文字サイズ・行間・テーマ" />
        <p className="text-sm text-fg-muted">
          Reading Mode の組版設定はトレーニング画面から変更できるようにします。
        </p>
      </Card>
    </div>
  )
}
