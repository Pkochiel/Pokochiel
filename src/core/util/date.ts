import type { LocalDate } from '../types/common'
import { toLocalDate } from '../types/common'

/**
 * 暦日を扱うためのユーティリティ。
 *
 * トレーニングの「今日」はユーザーのタイムゾーンにおける暦日で決まる。
 * UTC 日付で判定すると、深夜のトレーニングが前日扱いになり Streak が壊れる。
 * 現在時刻はここでは取得せず、必ず引数で受け取る（core は時刻に依存しない）。
 */
export function formatLocalDate(date: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  // en-CA は 'YYYY-MM-DD' 形式を返す
  return toLocalDate(parts)
}

export function parseLocalDate(value: LocalDate): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined || Number.isNaN(year)) {
    throw new Error(`Invalid LocalDate: ${value}`)
  }
  return { year, month, day }
}

function toUtcMillis(value: LocalDate): number {
  const { year, month, day } = parseLocalDate(value)
  return Date.UTC(year, month - 1, day)
}

const MS_PER_DAY = 86_400_000

function fromUtcMillis(millis: number): LocalDate {
  const date = new Date(millis)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return toLocalDate(`${year}-${month}-${day}`)
}

export function addDays(value: LocalDate, days: number): LocalDate {
  return fromUtcMillis(toUtcMillis(value) + days * MS_PER_DAY)
}

/** a - b を日数で返す。 */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtcMillis(a) - toUtcMillis(b)) / MS_PER_DAY)
}

export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  return toUtcMillis(a) - toUtcMillis(b)
}

export function isSameOrBefore(a: LocalDate, b: LocalDate): boolean {
  return compareLocalDate(a, b) <= 0
}

/**
 * 連続実施日数。日付の重複は 1 日として数える。
 * today に実施がない場合、前日までの連続が続いていれば streak は維持される
 * （その日の分をまだ実施していないだけであり、途切れたとは扱わない）。
 */
export function calculateStreak(dates: readonly LocalDate[], today: LocalDate): number {
  const unique = [...new Set(dates)].sort(compareLocalDate).reverse()
  const latest = unique[0]
  if (latest === undefined) return 0

  const gapFromToday = diffDays(today, latest)
  if (gapFromToday > 1) return 0

  let streak = 1
  let cursor = latest
  for (const date of unique.slice(1)) {
    if (diffDays(cursor, date) !== 1) break
    streak += 1
    cursor = date
  }
  return streak
}
