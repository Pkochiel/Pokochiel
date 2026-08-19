import { describe, expect, it } from 'vitest'
import { toLocalDate } from '../types/common'
import type { ReadingTest, RecallTask, TrainingResult, TrainingSession } from '../types/training'
import { makeResult, makeReadingTest } from '../__tests__/fixtures'
import { summarizeStats, type StatsSource } from './dashboard-stats'

const d = (value: string) => toLocalDate(value)
const TODAY = d('2026-08-19')


const readingTest = (overrides: Partial<ReadingTest> & { createdAt: string }): ReadingTest =>
  makeReadingTest({ passageId: 'gen-006', elapsedSeconds: 90, characterCount: 888, cpm: 592, ...overrides })

const result = (overrides: Partial<TrainingResult> & { createdAt: string }): TrainingResult =>
  makeResult(overrides)

const session = (localDate: string, completed = true): TrainingSession => ({
  id: `s-${localDate}`,
  userId: 'u',
  startedAt: `${localDate}T09:00:00Z`,
  completedAt: completed ? `${localDate}T09:30:00Z` : null,
  durationSeconds: completed ? 1800 : null,
  sessionType: 'daily',
  localDate: d(localDate),
})

const recallTask = (overrides: Partial<RecallTask> & { createdAt: string }): RecallTask => ({
  id: `rt-${overrides.createdAt}`,
  userId: 'u',
  passageId: 'p',
  sourceSessionId: null,
  scheduledDate: d('2026-08-19'),
  expiresOn: d('2026-08-22'),
  completedAt: null,
  recallScore: null,
  recallText: null,
  status: 'pending',
  ...overrides,
})

const source = (overrides: Partial<StatsSource> = {}): StatsSource => ({
  results: [],
  readingTests: [],
  recallTasks: [],
  sessions: [],
  today: TODAY,
  ...overrides,
})

describe('summarizeStats', () => {
  it('実績がなければすべて null、Streak は 0', () => {
    const stats = summarizeStats(source())
    expect(stats.currentCpm).toBeNull()
    expect(stats.comprehension).toBeNull()
    expect(stats.ers).toBeNull()
    expect(stats.streakDays).toBe(0)
  })

  it('Baseline だけでも指標が出る', () => {
    const stats = summarizeStats(
      source({ readingTests: [readingTest({ createdAt: '2026-08-19T09:00:00Z' })] }),
    )
    expect(stats.currentCpm).toBe(592)
    expect(stats.comprehension).toBe(80)
    expect(stats.immediateRecall).toBe(75)
    expect(stats.ers).toBe(Math.round(592 * 0.8 * 0.75))
  })

  it('Baseline と日々の結果を同じ時系列として扱う', () => {
    const stats = summarizeStats(
      source({
        readingTests: [readingTest({ createdAt: '2026-08-10T09:00:00Z', cpm: 500 })],
        results: [result({ createdAt: '2026-08-19T09:00:00Z', cpm: 700 })],
      }),
    )
    expect(stats.currentCpm).toBe(600)
    expect(stats.sampleCounts.cpm).toBe(2)
  })

  it('直近 5 件だけを平均する', () => {
    const results = Array.from({ length: 8 }, (_, i) =>
      result({ createdAt: `2026-08-${String(i + 1).padStart(2, '0')}T09:00:00Z`, cpm: (i + 1) * 100 }),
    )
    // 直近5件は 400,500,600,700,800 → 600
    expect(summarizeStats(source({ results })).currentCpm).toBe(600)
  })

  it('無効な計測を平均に含めない', () => {
    const stats = summarizeStats(
      source({
        results: [
          result({ createdAt: '2026-08-18T09:00:00Z', cpm: 600 }),
          result({ createdAt: '2026-08-19T09:00:00Z', cpm: 99999, valid: false }),
        ],
      }),
    )
    expect(stats.currentCpm).toBe(600)
    expect(stats.sampleCounts.cpm).toBe(1)
  })

  it('欠損している指標は他の指標に影響しない', () => {
    const stats = summarizeStats(
      source({
        results: [result({ createdAt: '2026-08-19T09:00:00Z', cpm: 800, comprehensionScore: null })],
      }),
    )
    expect(stats.currentCpm).toBe(800)
    expect(stats.comprehension).toBeNull()
    expect(stats.ers).toBeNull()
  })

  it('翌日 Recall は完了したタスクのみを集計する', () => {
    const stats = summarizeStats(
      source({
        recallTasks: [
          recallTask({ createdAt: '2026-08-17T09:00:00Z', status: 'completed', recallScore: 50 }),
          recallTask({ createdAt: '2026-08-18T09:00:00Z', status: 'completed', recallScore: 70 }),
          recallTask({ createdAt: '2026-08-19T09:00:00Z', status: 'pending' }),
          recallTask({ createdAt: '2026-08-16T09:00:00Z', status: 'expired' }),
        ],
      }),
    )
    expect(stats.nextDayRecall).toBe(60)
    expect(stats.sampleCounts.nextDayRecall).toBe(2)
  })

  it('完了したセッションから Streak を数える', () => {
    const stats = summarizeStats(
      source({
        sessions: [session('2026-08-17'), session('2026-08-18'), session('2026-08-19')],
      }),
    )
    expect(stats.streakDays).toBe(3)
  })

  it('未完了のセッションを Streak に数えない', () => {
    const stats = summarizeStats(
      source({ sessions: [session('2026-08-18'), session('2026-08-19', false)] }),
    )
    expect(stats.streakDays).toBe(1)
  })

  it('作成順が乱れていても時系列で処理する', () => {
    const stats = summarizeStats(
      source({
        results: [
          result({ createdAt: '2026-08-19T09:00:00Z', cpm: 900 }),
          result({ createdAt: '2026-08-01T09:00:00Z', cpm: 100 }),
        ],
      }),
    )
    expect(stats.currentCpm).toBe(500)
  })
})
