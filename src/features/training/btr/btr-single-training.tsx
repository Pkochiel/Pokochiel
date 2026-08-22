'use client'

import { useMemo, useState } from 'react'
import { ButtonLink } from '@/components/ui/button'
import { formatLocalDate } from '@/core/util/date'
import { resolveTimezone } from '@/data/repositories'
import { findBtrEntry } from './btr-catalog'
import { BtrScreen } from './shared/btr-shell'

/**
 * 1種目だけを開いて試す画面。
 *
 * セッション構成の置き換えはまだなので、結果は保存しない。
 * 保存はセッションの仕組みごと差し替えるとき（Phase 3-F）にまとめて入れる。
 */

export interface BtrSingleTrainingProps {
  readonly slug: string
}

export function BtrSingleTraining({ slug }: BtrSingleTrainingProps) {
  const entry = findBtrEntry(slug)
  const [done, setDone] = useState(false)

  // その日の課題を決める種。同じ日なら同じ課題が出る。
  const seed = useMemo(() => formatLocalDate(new Date(), resolveTimezone()), [])

  if (!entry) return null

  if (entry.Component === null) {
    return (
      <BtrScreen>
        <h1 className="text-xl font-semibold">{entry.name}</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          この種目はまだ画面ができていません。
        </p>
        <ButtonLink href="/btr" variant="secondary" className="mt-8 w-full sm:w-auto">
          一覧へ戻る
        </ButtonLink>
      </BtrScreen>
    )
  }

  if (done) {
    return (
      <BtrScreen>
        <h1 className="text-xl font-semibold">{entry.name} を終えました</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          いまは記録を保存していません。
          セッションの仕組みごと BTR に差し替えるときに、記録と推移を入れます。
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/btr" className="w-full sm:w-auto">
            一覧へ戻る
          </ButtonLink>
          <button
            type="button"
            onClick={() => setDone(false)}
            className="text-sm text-fg-muted hover:text-fg"
          >
            もう一度やる
          </button>
        </div>
      </BtrScreen>
    )
  }

  const Block = entry.Component
  return <Block key={String(done)} seed={seed} onComplete={() => setDone(true)} />
}
