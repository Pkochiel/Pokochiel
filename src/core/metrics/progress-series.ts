import type { LocalDate } from '../types/common'
import type { ReadingTest, RecallTask, TrainingResult, TrainingSession } from '../types/training'
import { addDays, compareLocalDate, formatLocalDate } from '../util/date'

export interface SeriesPoint {
  date: LocalDate
  /** その日に実績がなければ null（0 と区別する） */
  value: number | null
}

export interface ProgressSeries {
  cpm: SeriesPoint[]
  comprehension: SeriesPoint[]
  immediateRecall: SeriesPoint[]
  delayedRecall: SeriesPoint[]
}

export interface ProgressSeriesInput {
  results: readonly TrainingResult[]
  readingTests: readonly ReadingTest[]
  recallTasks: readonly RecallTask[]
  sessions: readonly TrainingSession[]
  /** 表示期間の終端（通常は今日） */
  today: LocalDate
  days: number
  timezone: string
}

type Bucket = Map<LocalDate, number[]>

function push(bucket: Bucket, date: LocalDate, value: number | null | undefined): void {
  if (value === null || value === undefined) return
  const values = bucket.get(date)
  if (values) values.push(value)
  else bucket.set(date, [value])
}

function toSeries(bucket: Bucket, dates: readonly LocalDate[]): SeriesPoint[] {
  return dates.map((date) => {
    const values = bucket.get(date)
    return {
      date,
      value:
        values && values.length > 0
          ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
          : null,
    }
  })
}

/**
 * 期間内の日ごとの推移を作る。
 *
 * 実績のない日は null にする。0 で埋めると「その日は成績が 0 だった」ように見え、
 * 折れ線が谷を作って読み違えるため。
 */
export function buildProgressSeries(input: ProgressSeriesInput): ProgressSeries {
  const dates: LocalDate[] = []
  for (let i = input.days - 1; i >= 0; i -= 1) dates.push(addDays(input.today, -i))
  const first = dates[0]

  const inRange = (date: LocalDate) =>
    first !== undefined &&
    compareLocalDate(date, first) >= 0 &&
    compareLocalDate(date, input.today) <= 0

  const dateOf = (iso: string) => formatLocalDate(new Date(iso), input.timezone)

  const cpm: Bucket = new Map()
  const comprehension: Bucket = new Map()
  const immediateRecall: Bucket = new Map()
  const delayedRecall: Bucket = new Map()

  const sessionDate = new Map(input.sessions.map((s) => [s.id, s.localDate]))

  for (const result of input.results) {
    if (!result.valid) continue
    const date = sessionDate.get(result.sessionId) ?? dateOf(result.createdAt)
    if (!inRange(date)) continue
    push(cpm, date, result.cpm)
    push(comprehension, date, result.comprehensionScore)
    push(immediateRecall, date, result.immediateRecallScore)
  }

  for (const test of input.readingTests) {
    const date = dateOf(test.createdAt)
    if (!inRange(date)) continue
    push(cpm, date, test.cpm)
    push(comprehension, date, test.comprehensionScore)
    push(immediateRecall, date, test.recallScore)
  }

  for (const task of input.recallTasks) {
    if (task.status !== 'completed' || !task.completedAt) continue
    const date = dateOf(task.completedAt)
    if (!inRange(date)) continue
    push(delayedRecall, date, task.recallScore)
  }

  return {
    cpm: toSeries(cpm, dates),
    comprehension: toSeries(comprehension, dates),
    immediateRecall: toSeries(immediateRecall, dates),
    delayedRecall: toSeries(delayedRecall, dates),
  }
}

/** 実績のある点だけを返す。データの有無の判定に使う。 */
export function presentPoints(series: readonly SeriesPoint[]): SeriesPoint[] {
  return series.filter((p) => p.value !== null)
}
