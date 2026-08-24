type ClassValue = string | number | false | null | undefined

/** クラス名を連結する最小ヘルパー。外部依存を増やさないため自前で持つ。 */
export function cn(...values: ClassValue[]): string {
  return values.filter((v): v is string | number => Boolean(v)).join(' ')
}
