'use client'

import { useEffect, useState } from 'react'
import { summarizeStats, type DashboardStats } from '@/core/metrics/dashboard-stats'
import { computeSkillProfile } from '@/core/metrics/skill-profile'
import { formatLocalDate } from '@/core/util/date'
import type { Profile, RecallTask, SkillProfile } from '@/core/types'
import { getRepository, resolveTimezone } from '@/data/repositories'

export interface DashboardData {
  loading: boolean
  profile: Profile | null
  stats: DashboardStats | null
  skillProfile: SkillProfile | null
  dueRecallTasks: RecallTask[]
}

/**
 * Dashboard に必要なデータをまとめて読み込む。
 * Phase 1 は端末内（localStorage）から読むが、Repository 越しにしか触らないため
 * Phase 2 で Supabase に切り替えても、この hook 以下は変わらない。
 */
export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    loading: true,
    profile: null,
    stats: null,
    skillProfile: null,
    dueRecallTasks: [],
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const repository = getRepository()
      const timezone = resolveTimezone()
      const today = formatLocalDate(new Date(), timezone)

      const [profile, results, readingTests, recallTasks, sessions, dueRecallTasks] =
        await Promise.all([
          repository.getProfile(),
          repository.listResults(),
          repository.listReadingTests(),
          repository.listRecallTasks(),
          repository.listSessions(),
          repository.listDueRecallTasks(today),
        ])

      if (cancelled) return
      setData({
        loading: false,
        profile,
        stats: summarizeStats({ results, readingTests, recallTasks, sessions, today }),
        skillProfile: computeSkillProfile({
          results,
          recallTasks,
          baselineCpm: profile?.baselineCpm ?? null,
        }),
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
