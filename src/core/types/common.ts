/** ユーザーのタイムゾーンにおける暦日。'YYYY-MM-DD' 形式。 */
export type LocalDate = string & { readonly __brand: 'LocalDate' }

export const toLocalDate = (value: string): LocalDate => value as LocalDate

export interface DateRange {
  from: LocalDate
  to: LocalDate
}

export type Difficulty = 1 | 2 | 3 | 4 | 5

export type ChunkLevel = 1 | 2 | 3 | 4 | 5

/** 1日のトレーニング総時間（分）。 */
export type PlanDuration = 10 | 20 | 30
