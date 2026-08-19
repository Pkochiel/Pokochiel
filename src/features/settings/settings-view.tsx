'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader } from '@/components/ui/card'
import { PLAN } from '@/core/config/training-config'
import type { PlanDuration, Profile } from '@/core/types'
import { cn } from '@/lib/cn'
import { getRepository } from '@/data/repositories'

const DURATIONS: PlanDuration[] = [10, 20, 30]

export function SettingsView() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  const selectDuration = async (minutes: PlanDuration) => {
    setSaving(true)
    const updated = await getRepository().saveProfile({ preferredDurationMinutes: minutes })
    setProfile(updated)
    setSaving(false)
    setSaved(true)
  }

  const current = profile?.preferredDurationMinutes ?? 30

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">トレーニング時間と表示の設定</p>
      </header>

      <Card>
        <CardHeader
          title="1日のトレーニング時間"
          description="選んだ時間に合わせて、翌日以降の構成が自動で組み直されます。"
        />
        <div className="flex gap-2">
          {DURATIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              disabled={saving}
              onClick={() => void selectDuration(minutes)}
              aria-pressed={current === minutes}
              className={cn(
                'tabular flex-1 rounded-xl border py-3 text-sm font-medium transition-colors',
                current === minutes ? 'border-brand bg-brand-soft text-brand' : 'border-border',
              )}
            >
              {minutes} 分
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-fg-subtle">
          {current} 分のうち{' '}
          {Object.values(PLAN.core[current]).reduce((a, b) => a + b, 0)} 分が必須のトレーニング、
          残り {PLAN.optionalBudget[current]} 分は弱点に応じて選ばれます。
        </p>
        {saved ? <p className="mt-2 text-xs text-positive">保存しました。</p> : null}
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

      <Card>
        <CardHeader title="表示" description="テーマは端末の設定（ライト / ダーク）に追従します。" />
        <p className="text-sm text-fg-muted">
          Reading Mode の本文は明朝体で組み、行間を広めに取っています。
        </p>
      </Card>
    </div>
  )
}
