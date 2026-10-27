'use client'

import { useEffect, useState } from 'react'
import {
  latestSession,
  summarizeReadingSpeed,
  trainingStreak,
  type BtrRecordLike,
  type ReadingSpeedSummary,
} from '@/core/metrics/btr-progress'
import { formatLocalDate } from '@/core/util/date'
import type { LocalDate, Profile, RecallTask } from '@/core/types'
import { getRepository, resolveTimezone } from '@/data/repositories'

/**
 * Dashboard に出すもの。
 *
 * 「今日やったか」「続いているか」「入会時の何倍か」の3つに絞る。
 * 開いた瞬間に分かるべきなのはこれだけで、種目ごとの数字は推移の画面で見る。
 */

export interface DashboardData {
  readonly loading: boolean
  readonly profile: Profile | null
  readonly today: LocalDate | null
  /** 続けている日数 */
  readonly streakDays: number
  /** 直近1日ぶんの記録 */
  readonly latest: { date: LocalDate; records: readonly BtrRecordLike[] } | null
  readonly reading: ReadingSpeedSummary | null
  readonly dueRecallTasks: readonly RecallTask[]
}

const IDLE: DashboardData = {
  loading: true,
  profile: null,
  today: null,
  streakDays: 0,
  latest: null,
  reading: null,
  dueRecallTasks: [],
}

export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>(IDLE)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const repository = getRepository()
      const today = formatLocalDate(new Date(), resolveTimezone())

      const [profile, results, dueRecallTasks] = await Promise.all([
        repository.getProfile(),
        repository.listBtrResults(),
        repository.listDueRecallTasks(today),
      ])
      if (cancelled) return

      setData({
        loading: false,
        profile,
        today,
        streakDays: trainingStreak(results, today),
        latest: latestSession(results),
        reading: summarizeReadingSpeed(results, profile?.baselineCpm ?? null),
        dueRecallTasks,
      })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return data
}
