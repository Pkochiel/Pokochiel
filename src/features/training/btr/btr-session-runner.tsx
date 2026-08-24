'use client'

import { createElement, useState } from 'react'
import type { BtrSessionMinutes } from '@/core/planner/btr-session'
import type { BtrExercise } from '@/core/training/btr/exercises'
import { BTR_STAGE_LABELS, btrExercise } from '@/core/training/btr/exercises'
import {
  levelLabel,
  nextLevel,
  type BtrJudgement,
} from '@/core/training/btr/progression'
import { Button, ButtonLink } from '@/components/ui/button'
import { btrComponentFor } from './btr-catalog'
import { BtrScreen } from './shared/btr-shell'
import type { BtrOutcome } from './shared/btr-block'
import {
  judgementFor,
  saveBtrResult,
  useBtrSession,
  useCompleteBtrSession,
} from './use-btr-session'

/**
 * その日のトレーニングを通す画面。
 *
 * 種目を順に出し、終わるたびに記録を残す。
 * 途中で閉じても、そこまでの記録は残る（最後にまとめて保存しない）。
 */

export interface BtrSessionRunnerProps {
  readonly minutes: BtrSessionMinutes
}

interface Finished {
  readonly exercise: BtrExercise
  readonly name: string
  readonly score: number
  readonly variant: string | undefined
  /** 級が動いたときだけ入る（「6級 → 5級」） */
  readonly levelMove: string | null
}

/** 級が動いたときだけ「6級 → 5級」を作る。動かなければ null。 */
function describeLevelMove(
  exercise: BtrExercise,
  level: number | null,
  judgement: BtrJudgement | null,
): string | null {
  if (level === null || judgement === null || judgement === 'stay') return null
  const after = nextLevel(exercise, level, judgement)
  if (after === level) return null
  return `${levelLabel(exercise, level)} → ${levelLabel(exercise, after)}`
}

export function BtrSessionRunner({ minutes }: BtrSessionRunnerProps) {
  const { loading, session, sessionId, today, levels } = useBtrSession(minutes)
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState<readonly Finished[]>([])
  // 開始時刻。押されたときに入れる（描画中に現在時刻を取らない）。
  const [startedAt, setStartedAt] = useState(0)
  const completeSession = useCompleteBtrSession()

  if (loading || session === null || sessionId === null || today === null) {
    return (
      <BtrScreen>
        <p className="text-sm text-fg-muted">今日の組み立てを用意しています…</p>
      </BtrScreen>
    )
  }

  const block = session.blocks[index]

  if (!started) {
    return (
      <BtrScreen>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          BTR メソッド
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">今日の {minutes} 分</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          {session.blocks.length} 種目を順に行います。
          認知視野と処理系は日替わりです。久しく触っていない種目から先に出ます。
        </p>

        <ol className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
          {session.blocks.map((item) => (
            <li key={item.exercise} className="flex items-baseline gap-3 px-4 py-3">
              <span className="w-24 shrink-0 text-xs text-fg-muted">
                {BTR_STAGE_LABELS[item.stage]}
              </span>
              <span className="flex-1 text-sm font-medium">{item.name}</span>
              <span className="tabular text-sm text-fg-muted">{item.minutes} 分</span>
            </li>
          ))}
        </ol>

        <Button
          size="lg"
          className="mt-8 w-full sm:w-auto"
          onClick={() => {
            setStartedAt(Date.now())
            setStarted(true)
          }}
        >
          はじめる
        </Button>
      </BtrScreen>
    )
  }

  if (block) {
    const level = btrExercise(block.exercise).leveled ? (levels[block.exercise] ?? 0) : null

    const complete = (outcome: BtrOutcome) => {
      const input = {
        sessionId,
        localDate: today,
        exercise: block.exercise,
        level,
        ...outcome,
      }
      // 保存を待たずに次へ進める。書き込みが遅れてもトレーニングは止めない。
      void saveBtrResult(input)
      setFinished((current) => [
        ...current,
        {
          exercise: block.exercise,
          name: block.name,
          score: outcome.score,
          variant: outcome.variant,
          levelMove: describeLevelMove(block.exercise, level, judgementFor(input)),
        },
      ])
      if (index + 1 >= session.blocks.length) {
        void completeSession(sessionId, startedAt)
      }
      setIndex((current) => current + 1)
    }

    // 一覧から引いた画面を出す。createElement なのは、種目ごとに
    // if を13本並べたくないため。引いているだけで、ここで部品は作っていない。
    return createElement(btrComponentFor(block.exercise), {
      key: `${block.exercise}-${index}`,
      seed: today,
      ...(level !== null ? { level } : {}),
      onComplete: complete,
    })
  }

  return (
    <BtrScreen>
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
        今日の記録
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">終わりました</h1>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">
        種目ごとの数字を並べて残しています。1回ごとの上下より、
        何週かの向きを見てください。
      </p>

      <dl className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
        {finished.map((item) => (
          <div
            key={`${item.exercise}-${item.variant ?? ''}`}
            className="flex items-center justify-between px-4 py-3"
          >
            <dt className="text-sm text-fg-muted">
              {item.name}
              {item.levelMove ? (
                <span className="mt-0.5 block text-xs text-brand">{item.levelMove}</span>
              ) : null}
            </dt>
            <dd className="tabular text-sm font-medium">{item.score}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/btr" className="w-full sm:w-auto">
          トレーニングへ戻る
        </ButtonLink>
        <ButtonLink href="/progress" variant="secondary" className="w-full sm:w-auto">
          推移を見る
        </ButtonLink>
      </div>
    </BtrScreen>
  )
}
