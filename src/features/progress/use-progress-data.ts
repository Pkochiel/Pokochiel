'use client'

import { useEffect, useState } from 'react'
import { computeSkillProfile } from '@/core/metrics/skill-profile'
import type { SkillProfile } from '@/core/types'
import { buildProgressSeries, type ProgressSeries } from '@/core/metrics/progress-series'
import { formatLocalDate } from '@/core/util/date'
import { getRepository, resolveTimezone } from '@/data/repositories'

export interface ProgressData {
  loading: boolean
  series: ProgressSeries | null
  skillProfile: SkillProfile | null
}

export function useProgressData(days: number): ProgressData {
  const [data, setData] = useState<ProgressData>({ loading: true, series: null, skillProfile: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const repository = getRepository()
      const timezone = resolveTimezone()
      const today = formatLocalDate(new Date(), timezone)

      const [results, readingTests, recallTasks, sessions, profile] = await Promise.all([
        repository.listResults(),
        repository.listReadingTests(),
        repository.listRecallTasks(),
        repository.listSessions(),
        repository.getProfile(),
      ])
      if (cancelled) return

      setData({
        loading: false,
        series: buildProgressSeries({
          results,
          readingTests,
          recallTasks,
          sessions,
          today,
          days,
          timezone,
        }),
        skillProfile: computeSkillProfile({
          results,
          recallTasks,
          baselineCpm: profile?.baselineCpm ?? null,
        }),
      })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [days])

  return data
}
