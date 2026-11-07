'use client'

import { useEffect, useState } from 'react'
import {
  summarizeBtrProgress,
  summarizeReadingSpeed,
  type BtrTrend,
  type ReadingSpeedSummary,
} from '@/core/metrics/btr-progress'
import { getRepository } from '@/data/repositories'

/**
 * 推移に出すもの（BTRメソッド）。
 *
 * 種目ごとの数字と、読書の伸びを別々に持つ。読書だけ分けているのは、
 * 「入会時の何倍か」がこのアプリの目標そのものだからで、
 * 他の種目と同じ行に並べると埋もれてしまう。
 */

export interface BtrProgressData {
  readonly loading: boolean
  readonly trends: readonly BtrTrend[]
  readonly reading: ReadingSpeedSummary | null
}

const IDLE: BtrProgressData = { loading: true, trends: [], reading: null }

export function useBtrProgress(): BtrProgressData {
  const [data, setData] = useState<BtrProgressData>(IDLE)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const repository = getRepository()
      const [results, profile] = await Promise.all([
        repository.listBtrResults(),
        repository.getProfile(),
      ])
      if (cancelled) return

      setData({
        loading: false,
        trends: summarizeBtrProgress(results),
        reading: summarizeReadingSpeed(results, profile?.baselineCpm ?? null),
      })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return data
}
