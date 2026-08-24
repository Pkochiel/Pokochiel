'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader } from '@/components/ui/card'
import type { Profile } from '@/core/types'
import { ButtonLink } from '@/components/ui/button'
import { getRepository } from '@/data/repositories'
import { BackupPanel } from './backup-panel'

export function SettingsView() {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let cancelled = false
    void getRepository()
      .getProfile()
      .then((loaded) => {
        if (!cancelled) setProfile(loaded)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="mt-1 text-sm text-fg-muted">基準値と、データの保存・持ち出し</p>
      </header>

      <Card>
        <CardHeader
          title="1回の長さ"
          description="始めるたびに選びます。ここでは決めません。"
        />
        <p className="text-sm leading-relaxed text-fg-muted">
          その日どれだけ取れるかは日によって違うので、トレーニングを始めるときに
          90 / 45 / 30 / 15 分から選びます。
        </p>
        <ButtonLink href="/btr" variant="secondary" size="sm" className="mt-4">
          トレーニングへ
        </ButtonLink>
      </Card>

      <Card>
        <CardHeader title="現在の基準値" description="Baseline Test の結果と、現在の目標速度。" />
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-fg-muted">Baseline CPM</dt>
            <dd className="tabular mt-1 font-medium">{profile?.baselineCpm ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Target CPM</dt>
            <dd className="tabular mt-1 font-medium">{profile?.targetCpm ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Chunk Level</dt>
            <dd className="tabular mt-1 font-medium">{profile?.chunkLevel ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">タイムゾーン</dt>
            <dd className="mt-1 font-medium">{profile?.timezone ?? '—'}</dd>
          </div>
        </dl>
      </Card>

      <BackupPanel />

      <Card>
        <CardHeader title="表示" description="テーマは端末の設定（ライト / ダーク）に追従します。" />
        <p className="text-sm text-fg-muted">
          Reading Mode の本文は明朝体で組み、行間を広めに取っています。
        </p>
      </Card>
    </div>
  )
}
