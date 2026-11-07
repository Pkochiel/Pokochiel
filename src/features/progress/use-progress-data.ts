'use client'

import { useEffect, useState } from 'react'
import { buildProgressSeries, type ProgressSeries } from '@/core/metrics/progress-series'
import { formatLocalDate } from '@/core/util/date'
import { getRepository, resolveTimezone } from '@/data/repositories'

export interface ProgressData {
  loading: boolean
  series: ProgressSeries | null
}

export function useProgressData(days: number): ProgressData {
  const [data, setData] = useState<ProgressData>({ loading: true, series: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const repository = getRepository()
      const timezone = resolveTimezone()
      const today = formatLocalDate(new Date(), timezone)

      const [results, readingTests, recallTasks, sessions] = await Promise.all([
        repository.listResults(),
        repository.listReadingTests(),
        repository.listRecallTasks(),
        repository.listSessions(),
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
      })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [days])

  return data
}
