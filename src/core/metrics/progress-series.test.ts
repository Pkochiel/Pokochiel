import { describe, expect, it } from 'vitest'
import { toLocalDate } from '../types/common'
import type { ReadingTest, RecallTask, TrainingResult, TrainingSession } from '../types/training'
import { buildProgressSeries, presentPoints, type ProgressSeriesInput } from './progress-series'

const d = (v: string) => toLocalDate(v)
const TZ = 'Asia/Tokyo'

const session = (id: string, localDate: string): TrainingSession => ({
  id,
  userId: 'u',
  startedAt: `${localDate}T09:00:00Z`,
  completedAt: `${localDate}T09:30:00Z`,
  durationSeconds: 1800,
  sessionType: 'daily',
  localDate: d(localDate),
})

const result = (
  sessionId: string,
  overrides: Partial<TrainingResult> = {},
): TrainingResult => ({
  id: Math.random().toString(),
  userId: 'u',
  sessionId,
  trainingType: 'speed_push',
  passageId: 'p',
  cpm: null,
  comprehensionScore: null,
  immediateRecallScore: null,
  delayedRecallScore: null,
  targetCpm: null,
  backCount: null,
  pauseCount: null,
  chunkLevel: null,
  difficulty: null,
  valid: true,
  createdAt: '2026-08-19T09:00:00Z',
  ...overrides,
})

const input = (overrides: Partial<ProgressSeriesInput> = {}): ProgressSeriesInput => ({
  results: [],
  readingTests: [],
  recallTasks: [],
  sessions: [],
  today: d('2026-08-19'),
  days: 7,
  timezone: TZ,
  ...overrides,
})

describe('buildProgressSeries', () => {
  it('指定日数ぶんの点を、古い順に返す', () => {
    const series = buildProgressSeries(input({ days: 7 }))
    expect(series.cpm).toHaveLength(7)
    expect(series.cpm[0]?.date).toBe('2026-08-13')
    expect(series.cpm[6]?.date).toBe('2026-08-19')
  })

  it('実績のない日は null にする（0 で埋めない）', () => {
    const series = buildProgressSeries(input())
    expect(series.cpm.every((p) => p.value === null)).toBe(true)
  })

  it('同じ日に複数の実績があれば平均する', () => {
    const series = buildProgressSeries(
      input({
        sessions: [session('s1', '2026-08-19')],
        results: [result('s1', { cpm: 600 }), result('s1', { cpm: 800 })],
      }),
    )
    expect(series.cpm[6]?.value).toBe(700)
  })

  it('セッションの暦日で集計する（UTC 日付では分けない）', () => {
    const series = buildProgressSeries(
      input({
        sessions: [session('s1', '2026-08-18')],
        results: [result('s1', { cpm: 600, createdAt: '2026-08-18T16:30:00Z' })],
      }),
    )
    expect(series.cpm[5]?.date).toBe('2026-08-18')
    expect(series.cpm[5]?.value).toBe(600)
  })

  it('期間外の実績を含めない', () => {
    const series = buildProgressSeries(
      input({
        days: 7,
        sessions: [session('old', '2026-07-01')],
        results: [result('old', { cpm: 600 })],
      }),
    )
    expect(presentPoints(series.cpm)).toHaveLength(0)
  })

  it('無効な計測を含めない', () => {
    const series = buildProgressSeries(
      input({
        sessions: [session('s1', '2026-08-19')],
        results: [result('s1', { cpm: 99999, valid: false })],
      }),
    )
    expect(series.cpm[6]?.value).toBeNull()
  })

  it('Baseline の測定も同じ系列に含める', () => {
    const test: ReadingTest = {
      id: 't1',
      userId: 'u',
      sessionId: null,
      passageId: 'gen-006',
      isBaseline: true,
      elapsedSeconds: 90,
      characterCount: 888,
      cpm: 592,
      comprehensionScore: 80,
      recallScore: 75,
      recallText: null,
      createdAt: '2026-08-17T09:00:00Z',
    }
    const series = buildProgressSeries(input({ readingTests: [test] }))
    expect(series.cpm[4]?.value).toBe(592)
    expect(series.comprehension[4]?.value).toBe(80)
    expect(series.immediateRecall[4]?.value).toBe(75)
  })

  it('翌日 Recall は完了した日に記録する', () => {
    const task: RecallTask = {
      id: 'r1',
      userId: 'u',
      passageId: 'p',
      sourceSessionId: null,
      scheduledDate: d('2026-08-18'),
      expiresOn: d('2026-08-21'),
      completedAt: '2026-08-18T10:00:00Z',
      recallScore: 50,
      recallText: null,
      status: 'completed',
      createdAt: '2026-08-17T09:00:00Z',
    }
    const series = buildProgressSeries(input({ recallTasks: [task] }))
    expect(series.delayedRecall[5]?.value).toBe(50)
  })

  it('未完了の Recall は含めない', () => {
    const task: RecallTask = {
      id: 'r1',
      userId: 'u',
      passageId: 'p',
      sourceSessionId: null,
      scheduledDate: d('2026-08-19'),
      expiresOn: d('2026-08-22'),
      completedAt: null,
      recallScore: null,
      recallText: null,
      status: 'pending',
      createdAt: '2026-08-18T09:00:00Z',
    }
    const series = buildProgressSeries(input({ recallTasks: [task] }))
    expect(presentPoints(series.delayedRecall)).toHaveLength(0)
  })

  it('30 日・90 日でも同じ形で返る', () => {
    for (const days of [30, 90]) {
      expect(buildProgressSeries(input({ days })).cpm).toHaveLength(days)
    }
  })
})
