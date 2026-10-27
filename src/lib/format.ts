/** 秒を mm:ss で表示する。1時間を超える想定はしない。 */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function formatInteger(value: number): string {
  return Math.round(value).toLocaleString('ja-JP')
}

/** 値がない場合の表示。0 と欠損を混同させない。 */
export const EMPTY_VALUE = '—'

export function formatScore(value: number | null, suffix = ''): string {
  return value === null ? EMPTY_VALUE : `${Math.round(value)}${suffix}`
}
