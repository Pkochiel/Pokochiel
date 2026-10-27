'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  buildBtrSession,
  type BtrSession,
  type BtrSessionMinutes,
} from '@/core/planner/btr-session'
import { BTR_EXERCISES, type BtrExercise } from '@/core/training/btr/exercises'
import {
  currentLevel,
  judgeBtr,
  type BtrJudgement,
  type LevelHistoryEntry,
} from '@/core/training/btr/progression'
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

      // 種目ごとの「最後にやった日」。記録は古い順に並ぶので、
      // 後から来たもので上書きすれば最新が残る。
      const lastDoneAt: Partial<Record<BtrExercise, string>> = {}
      for (const result of history) {
        lastDoneAt[result.exercise as BtrExercise] = result.localDate
      }

      // いまの級は記録から出す。級そのものを持ち越さないのは、
      // 判定の条件を変えたときに過去の記録から引き直せるようにするため。
      const entries: LevelHistoryEntry[] = history.map((result) => ({
        exercise: result.exercise,
        level: result.level,
        judgement: result.judgement,
      }))
      const levels: Partial<Record<BtrExercise, number>> = {}
      for (const spec of BTR_EXERCISES) {
        if (spec.leveled) levels[spec.id] = currentLevel(spec.id, entries)
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

/**
 * その回の判定。
 *
 * 保存と表示の両方から呼ぶ。片方で別に出すと、画面が「上がった」と言いながら
 * 記録は据え置き、ということが起こりうる。
 */
export function judgementFor(input: SaveBtrResultInput): BtrJudgement | null {
  if (input.level === null) return null
  return judgeBtr(input.exercise, {
    score: input.score,
    accuracy: input.accuracy ?? null,
    // 段によって求めるスコアが変わる種目（サッケイド）があるので、
    // そのとき課されていた段も渡す。
    level: input.level,
  })
}

/** 種目1回分を保存する。保存に失敗してもトレーニングは止めない。 */
export async function saveBtrResult(input: SaveBtrResultInput): Promise<void> {
  const judgement = judgementFor(input)

  await getRepository().saveBtrResult({
    sessionId: input.sessionId,
    localDate: input.localDate,
    exercise: input.exercise,
    level: input.level,
    judgement,
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
