import { SCORING } from '../config/training-config'
import type { LocalDate } from '../types/common'
import type { ReadingTest, RecallTask, TrainingResult, TrainingSession } from '../types/training'
import { calculateStreak } from '../util/date'
import { calculateErs } from './ers'

export interface StatsSource {
  results: readonly TrainingResult[]
  readingTests: readonly ReadingTest[]
  recallTasks: readonly RecallTask[]
  sessions: readonly TrainingSession[]
  today: LocalDate
}

export interface DashboardStats {
  currentCpm: number | null
  comprehension: number | null
  immediateRecall: number | null
  nextDayRecall: number | null
  streakDays: number
  ers: number | null
  /** 各指標が何件の実績から算出されたか。表示の信頼度を伝えるために持つ。 */
  sampleCounts: {
    cpm: number
    comprehension: number
    immediateRecall: number
    nextDayRecall: number
  }
}

/** 古い順に並んだ値から、直近 N 件の平均を取る。 */
function recentMean(values: readonly number[], window = SCORING.recentWindow): number | null {
  const recent = values.slice(-window)
  if (recent.length === 0) return null
  return Math.round(recent.reduce((sum, v) => sum + v, 0) / recent.length)
}

function byCreatedAt<T extends { createdAt: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * Dashboard に出す指標をまとめる。
 *
 * Baseline（reading_tests）と日々のトレーニング（training_results）は
 * どちらも同じ指標の実績なので、時系列に統合したうえで直近を見る。
 * 無効な計測は呼び出し側で除外済みである前提だが、ここでも valid を確認する。
 */
export function summarizeStats(source: StatsSource): DashboardStats {
  const results = byCreatedAt(source.results).filter((r) => r.valid)
  const readingTests = byCreatedAt(source.readingTests)

  const timeline = byCreatedAt([
    ...results.map((r) => ({
      createdAt: r.createdAt,
      cpm: r.cpm,
      comprehension: r.comprehensionScore,
      immediateRecall: r.immediateRecallScore,
    })),
    ...readingTests.map((t) => ({
      createdAt: t.createdAt,
      cpm: t.cpm,
      comprehension: t.comprehensionScore,
      immediateRecall: t.recallScore,
    })),
  ])

  const cpmValues = timeline.flatMap((e) => (e.cpm === null ? [] : [e.cpm]))
  const comprehensionValues = timeline.flatMap((e) =>
    e.comprehension === null ? [] : [e.comprehension],
  )
  const immediateRecallValues = timeline.flatMap((e) =>
    e.immediateRecall === null ? [] : [e.immediateRecall],
  )

  const delayedRecallValues = [
    ...byCreatedAt(source.recallTasks.filter((t) => t.status === 'completed')),
  ].flatMap((t) => (t.recallScore === null ? [] : [t.recallScore]))

  const currentCpm = recentMean(cpmValues)
  const comprehension = recentMean(comprehensionValues)
  const immediateRecall = recentMean(immediateRecallValues)

  return {
    currentCpm,
    comprehension,
    immediateRecall,
    nextDayRecall: recentMean(delayedRecallValues),
    streakDays: calculateStreak(
      source.sessions.filter((s) => s.completedAt !== null).map((s) => s.localDate),
      source.today,
    ),
    ers: calculateErs({
      cpm: currentCpm,
      comprehensionScore: comprehension,
      recallScore: immediateRecall,
    }),
    sampleCounts: {
      cpm: cpmValues.length,
      comprehension: comprehensionValues.length,
      immediateRecall: immediateRecallValues.length,
      nextDayRecall: delayedRecallValues.length,
    },
  }
}
