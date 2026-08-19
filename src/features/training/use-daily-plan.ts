'use client'

import { useCallback, useEffect, useState } from 'react'
import { computeSkillProfile } from '@/core/metrics/skill-profile'
import { generateDailyPlan, toCandidates } from '@/core/planner/daily-plan'
import { initialTargetCpm } from '@/core/metrics/cpm'
import { CHUNKING, MEANING_FLASH } from '@/core/config/training-config'
import { formatLocalDate } from '@/core/util/date'
import type { DailyTrainingPlan, Difficulty, Profile } from '@/core/types'
import { ALL_PASSAGES } from '@/data/content'
import { getRepository, resolveTimezone } from '@/data/repositories'

/** Baseline 未実施でも試せるようにするための暫定速度。 */
const FALLBACK_CPM = 600

/** 理解度から教材の難易度を選ぶ。高すぎる教材で理解度を落とさない。 */
function preferredDifficulty(comprehension: number | null): Difficulty {
  if (comprehension === null) return 3
  if (comprehension >= 90) return 4
  if (comprehension >= 75) return 3
  return 2
}

export interface DailyPlanState {
  loading: boolean
  plan: DailyTrainingPlan | null
  profile: Profile | null
  reload: () => void
}

/**
 * 当日のトレーニング構成を取得する。未生成なら生成して保存する。
 * 「今日は何をやればいいのか」をユーザーに考えさせないための入口。
 */
export function useDailyPlan(): DailyPlanState {
  const [state, setState] = useState<DailyPlanState>({
    loading: true,
    plan: null,
    profile: null,
    reload: () => undefined,
  })
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const repository = getRepository()
      const timezone = resolveTimezone()
      const today = formatLocalDate(new Date(), timezone)

      const [profile, existing, results, recallTasks, dueRecall] = await Promise.all([
        repository.getProfile(),
        repository.getPlan(today),
        repository.listResults(),
        repository.listRecallTasks(),
        repository.listDueRecallTasks(today),
      ])

      if (existing) {
        if (!cancelled) setState({ loading: false, plan: existing, profile, reload })
        return
      }

      const baselineCpm = profile?.baselineCpm ?? null
      const skillProfile = computeSkillProfile({ results, recallTasks, baselineCpm })
      const recentPassageIds = results.flatMap((r) => (r.passageId ? [r.passageId] : []))

      const plan = generateDailyPlan({
        date: today,
        totalMinutes: profile?.preferredDurationMinutes ?? 30,
        profile: skillProfile,
        passages: toCandidates(ALL_PASSAGES),
        recentPassageIds,
        dueRecallCount: dueRecall.length,
        targetCpm: profile?.targetCpm ?? initialTargetCpm(baselineCpm ?? FALLBACK_CPM),
        chunkLevel: profile?.chunkLevel ?? CHUNKING.defaultLevel,
        meaningFlashLevel: profile?.meaningFlashLevel ?? MEANING_FLASH.defaultLevel,
        preferredDifficulty: preferredDifficulty(skillProfile.comprehension.score),
        userId: profile?.id ?? 'local-user',
        createdAt: new Date().toISOString(),
        planId: globalThis.crypto.randomUUID(),
      })

      await repository.savePlan(plan)
      if (!cancelled) setState({ loading: false, plan, profile, reload })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [nonce, reload])

  return state
}
