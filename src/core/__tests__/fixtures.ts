import { toLocalDate } from '../types/common'
import type {
  ReadingTest,
  RecallTask,
  TrainingResult,
  TrainingSession,
} from '../types/training'

/** テスト用のダミー結果。必要な項目だけ上書きして使う。 */
export function makeResult(overrides: Partial<TrainingResult> = {}): TrainingResult {
  return {
    id: `result-${Math.random().toString(36).slice(2)}`,
    userId: 'u',
    sessionId: 's',
    trainingType: 'speed_push',
    passageId: 'p',
    cpm: null,
    comprehensionScore: null,
    immediateRecallScore: null,
    delayedRecallScore: null,
    targetCpm: null,
    backCount: null,
    pauseCount: null,
    level: null,
    accuracyScore: null,
    exposureMs: null,
    difficulty: null,
    valid: true,
    createdAt: '2026-08-19T09:00:00Z',
    ...overrides,
  }
}

export function makeReadingTest(overrides: Partial<ReadingTest> = {}): ReadingTest {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    userId: 'u',
    sessionId: 's',
    passageId: 'base-001',
    isBaseline: true,
    elapsedSeconds: 150,
    characterCount: 1400,
    cpm: 560,
    comprehensionScore: 80,
    recallScore: 75,
    recallText: null,
    typeScores: null,
    createdAt: '2026-08-19T09:00:00Z',
    ...overrides,
  }
}

export function makeRecallTask(overrides: Partial<RecallTask> = {}): RecallTask {
  return {
    id: `recall-${Math.random().toString(36).slice(2)}`,
    userId: 'u',
    passageId: 'p',
    sourceSessionId: null,
    scheduledDate: toLocalDate('2026-08-19'),
    expiresOn: toLocalDate('2026-08-22'),
    completedAt: null,
    recallScore: null,
    recallText: null,
    status: 'pending',
    createdAt: '2026-08-19T09:00:00Z',
    ...overrides,
  }
}

export function makeSession(
  localDate: string,
  overrides: Partial<TrainingSession> = {},
): TrainingSession {
  return {
    id: `session-${localDate}`,
    userId: 'u',
    startedAt: `${localDate}T09:00:00Z`,
    completedAt: `${localDate}T09:30:00Z`,
    durationSeconds: 1800,
    sessionType: 'daily',
    localDate: toLocalDate(localDate),
    ...overrides,
  }
}

/** 一連の結果を作る（時系列で並ぶよう createdAt を振る）。 */
export function makeSeries(
  count: number,
  build: (index: number) => Partial<TrainingResult>,
): TrainingResult[] {
  return Array.from({ length: count }, (_, i) =>
    makeResult({
      createdAt: `2026-08-${String(i + 1).padStart(2, '0')}T09:00:00Z`,
      ...build(i),
    }),
  )
}
