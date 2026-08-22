'use client'

import { createElement, useEffect, useState } from 'react'
import { ButtonLink } from '@/components/ui/button'
import { btrExercise, type BtrExercise } from '@/core/training/btr/exercises'
import { formatLocalDate } from '@/core/util/date'
import type { LocalDate } from '@/core/types'
import { getRepository, resolveTimezone } from '@/data/repositories'
import { findBtrEntry } from './btr-catalog'
import { BtrScreen } from './shared/btr-shell'
import type { BtrOutcome } from './shared/btr-block'
import { saveBtrResult } from './use-btr-session'

/**
 * 1種目だけを開いて試す画面。
 *
 * 通しのセッションと同じように記録を残す。1種目だけ触った日も、
 * 種目ごとの推移には同じ1点として乗るのが自然である。
 */

export interface BtrSingleTrainingProps {
  readonly slug: string
}

interface Ready {
  readonly today: LocalDate
  readonly level: number | null
}

export function BtrSingleTraining({ slug }: BtrSingleTrainingProps) {
  const entry = findBtrEntry(slug)
  const exercise = entry?.exercise ?? null
  const [ready, setReady] = useState<Ready | null>(null)
  const [round, setRound] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (exercise === null) return
    let cancelled = false

    async function load(id: NonNullable<typeof exercise>) {
      const today = formatLocalDate(new Date(), resolveTimezone())
      // その種目のいまの級。記録がなければ最初の段から。
      const history = await getRepository().listBtrResults({ exercise: id })
      const last = history[history.length - 1]
      if (cancelled) return
      setReady({
        today,
        level: btrExercise(id).leveled ? (last?.level ?? 0) : null,
      })
    }

    void load(exercise)
    return () => {
      cancelled = true
    }
  }, [exercise])

  if (!entry || exercise === null) return null

  if (ready === null) {
    return (
      <BtrScreen>
        <p className="text-sm text-fg-muted">用意しています…</p>
      </BtrScreen>
    )
  }

  if (done) {
    return (
      <BtrScreen>
        <h1 className="text-xl font-semibold">{entry.name} を終えました</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          記録を残しました。1回ごとの上下より、何週かの向きを見てください。
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/btr" className="w-full sm:w-auto">
            一覧へ戻る
          </ButtonLink>
          <button
            type="button"
            onClick={() => {
              setRound((current) => current + 1)
              setDone(false)
            }}
            className="text-sm text-fg-muted hover:text-fg"
          >
            もう一度やる
          </button>
        </div>
      </BtrScreen>
    )
  }

  const complete = (outcome: BtrOutcome) => {
    void record(exercise, ready, outcome)
    setDone(true)
  }

  // 一覧から引いた画面を出す。createElement なのは、種目ごとに
  // if を13本並べたくないため。引いているだけで、ここで部品は作っていない。
  return createElement(entry.Component, {
    key: round,
    seed: ready.today,
    ...(ready.level !== null ? { level: ready.level } : {}),
    onComplete: complete,
  })
}

/**
 * 1種目だけの回も、通しの回と同じ形で残す。
 *
 * セッションはその場で作る。1種目だけ触った日も「いつやったか」が要るので、
 * 記録だけを宙に浮かせない。
 */
async function record(
  exercise: BtrExercise,
  ready: Ready,
  outcome: BtrOutcome,
): Promise<void> {
  const session = await getRepository().createSession({
    sessionType: 'btr',
    startedAt: new Date().toISOString(),
    localDate: ready.today,
  })
  await saveBtrResult({
    sessionId: session.id,
    localDate: ready.today,
    exercise,
    level: ready.level,
    ...outcome,
  })
}
