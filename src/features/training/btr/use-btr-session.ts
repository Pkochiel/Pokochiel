'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  buildBtrSession,
  type BtrSession,
  type BtrSessionMinutes,
} from '@/core/planner/btr-session'
import type { BtrExercise } from '@/core/training/btr/exercises'
import { formatLocalDate } from '@/core/util/date'
import type { LocalDate } from '@/core/types'
import { getRepository, resolveTimezone } from '@/data/repositories'

/**
 * その日の組み立てを用意する。
 *
 * 何をやるかは日付と、これまでの記録から決まる。久しく触っていない種目を
 * 先に持ってくるので、過去の記録を読んでから組み立てる。
 */

export interface BtrSessionState {
  readonly loading: boolean
  readonly session: BtrSession | null
  /** 記録を結びつけるセッション id */
  readonly sessionId: string | null
  readonly today: LocalDate | null
  /** 種目ごとのいまの級。記録がなければ 0。 */
  readonly levels: Readonly<Partial<Record<BtrExercise, number>>>
}

const IDLE: BtrSessionState = {
  loading: true,
  session: null,
  sessionId: null,
  today: null,
  levels: {},
}

export function useBtrSession(minutes: BtrSessionMinutes): BtrSessionState {
  const [state, setState] = useState<BtrSessionState>(IDLE)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const repository = getRepository()
      const today = formatLocalDate(new Date(), resolveTimezone())
      const history = await repository.listBtrResults()

      // 種目ごとの「最後にやった日」と「そのときの級」。
      // 記録は古い順に並ぶので、後から来たもので上書きすれば最新が残る。
      const lastDoneAt: Partial<Record<BtrExercise, string>> = {}
      const levels: Partial<Record<BtrExercise, number>> = {}
      for (const result of history) {
        const exercise = result.exercise as BtrExercise
        lastDoneAt[exercise] = result.localDate
        if (result.level !== null) levels[exercise] = result.level
      }

      const session = buildBtrSession({ minutes, seed: today, lastDoneAt })
      const record = await repository.createSession({
        sessionType: 'btr',
        startedAt: new Date().toISOString(),
        localDate: today,
      })

      if (cancelled) return
      setState({ loading: false, session, sessionId: record.id, today, levels })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [minutes])

  return state
}

export interface SaveBtrResultInput {
  readonly sessionId: string
  readonly localDate: LocalDate
  readonly exercise: BtrExercise
  readonly level: number | null
  readonly score: number
  readonly variant?: string | undefined
  readonly attempts?: readonly number[] | undefined
  readonly elapsedMs?: number | undefined
  readonly timeLimitMs?: number | undefined
  readonly accuracy?: number | undefined
  readonly lowerIsBetter?: boolean | undefined
  readonly cpm?: number | undefined
  readonly valid?: boolean | undefined
}

/** 種目1回分を保存する。保存に失敗してもトレーニングは止めない。 */
export async function saveBtrResult(input: SaveBtrResultInput): Promise<void> {
  await getRepository().saveBtrResult({
    sessionId: input.sessionId,
    localDate: input.localDate,
    exercise: input.exercise,
    level: input.level,
    score: input.score,
    variant: input.variant ?? null,
    attempts: input.attempts ? [...input.attempts] : [],
    elapsedMs: input.elapsedMs ?? null,
    timeLimitMs: input.timeLimitMs ?? null,
    accuracy: input.accuracy ?? null,
    lowerIsBetter: input.lowerIsBetter ?? false,
    cpm: input.cpm ?? null,
    valid: input.valid ?? true,
  })
}

/** 終わったセッションに終了時刻を入れる。 */
export function useCompleteBtrSession(): (id: string, startedAt: number) => Promise<void> {
  return useCallback(async (id: string, startedAt: number) => {
    await getRepository().completeSession(
      id,
      new Date().toISOString(),
      Math.round((Date.now() - startedAt) / 1000),
    )
  }, [])
}
