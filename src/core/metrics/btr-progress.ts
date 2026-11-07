import { BTR_EXERCISES, btrExercise, type BtrExercise } from '../training/btr/exercises'
import { currentLevel, levelLabel } from '../training/btr/progression'
import { measureProgress, type ReadingProgress } from '../training/btr/paced-reading'
import { SACCADE_AXIS_LABELS, type SaccadeAxis } from '../training/btr/saccade'
import type { LocalDate } from '../types/common'

/**
 * 種目ごとの推移（BTRメソッド）。
 *
 * 受講記録は「種目ごとの数値の並び」である。ひとつの総合点にまとめない。
 * まとめると、伸びている種目と落ちている種目が打ち消し合って
 * どちらも見えなくなる。
 *
 *   たてサッケイド 57 / よこサッケイド 77 / 数字ランダム 22・20・18・24 / ...
 */

/** 向きを判じるのに使う直近の回数。片側で足りなければ判じない。 */
const WINDOW = 3

/** 横ばいとみなす幅。測定の揺れを「伸びた」と言わないための余白。 */
const FLAT_BAND = 0.05

export interface BtrRecordLike {
  readonly exercise: string
  readonly variant: string | null
  readonly score: number
  readonly level: number | null
  readonly judgement: string | null
  readonly lowerIsBetter: boolean
  /** 分速（字/分）。読書だけが持つ。 */
  readonly cpm: number | null
  readonly localDate: LocalDate
}

export interface BtrPoint {
  readonly date: LocalDate
  readonly score: number
}

export type TrendDirection = 'up' | 'flat' | 'down' | 'unknown'

export interface BtrTrend {
  readonly exercise: BtrExercise
  /** サッケイドのたて・よこ。持たない種目は null。 */
  readonly variant: string | null
  /** 画面に出す名前。variant を持つ種目はそれを含む。 */
  readonly name: string
  readonly level: number
  /** 「6級」。級を持たない種目は null。 */
  readonly levelLabel: string | null
  readonly latest: number | null
  /** いちばん良かった回。小さいほうがよい種目では最小値。 */
  readonly best: number | null
  readonly lowerIsBetter: boolean
  /** 古い順。折れ線にそのまま渡せる。 */
  readonly points: readonly BtrPoint[]
  readonly direction: TrendDirection
  readonly attempts: number
}

/** variant を含めた表示名。 */
function displayName(exercise: BtrExercise, variant: string | null): string {
  const base = btrExercise(exercise).name
  if (variant === null) return base
  if (exercise === 'saccade') return SACCADE_AXIS_LABELS[variant as SaccadeAxis] ?? base
  return `${base}（${variant}）`
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * 直近の向き。
 *
 * 直近 WINDOW 回と、その前の WINDOW 回の平均を比べる。
 * 1回前とだけ比べると、その日の調子で上下して意味を成さない。
 * 両側がそろわないうちは判じない。
 */
export function trendDirection(
  points: readonly BtrPoint[],
  lowerIsBetter: boolean,
): TrendDirection {
  if (points.length < WINDOW * 2) return 'unknown'

  const scores = points.map((point) => point.score)
  const recent = mean(scores.slice(-WINDOW))
  const before = mean(scores.slice(-WINDOW * 2, -WINDOW))
  if (before === 0) {
    if (recent === 0) return 'flat'
    return lowerIsBetter ? 'down' : 'up'
  }

  const change = (recent - before) / Math.abs(before)
  if (Math.abs(change) < FLAT_BAND) return 'flat'
  const rising = change > 0
  return rising === !lowerIsBetter ? 'up' : 'down'
}

export interface SummarizeOptions {
  /** 折れ線に出す点の数。多すぎると1点ずつが読めなくなる。 */
  readonly maxPoints?: number
}

/** 種目一覧の並び。画面の並びが日によって変わらないようにする。 */
const ORDER = new Map(BTR_EXERCISES.map((spec, index) => [spec.id, index]))

/**
 * 記録を種目ごとにまとめる。
 *
 * 古い順に並んだ記録を渡すこと（Repository がそう返す）。
 * やった順ではなく種目一覧の順で返す。並びが日ごとに変わると、
 * どこを見ればよいのかを毎回探し直すことになる。
 */
export function summarizeBtrProgress(
  results: readonly BtrRecordLike[],
  options: SummarizeOptions = {},
): BtrTrend[] {
  const maxPoints = options.maxPoints ?? 20

  // 種目と variant の組ごとに束ねる。
  const groups = new Map<string, BtrRecordLike[]>()
  for (const result of results) {
    const key = `${result.exercise}::${result.variant ?? ''}`
    const group = groups.get(key)
    if (group) group.push(result)
    else groups.set(key, [result])
  }

  const trends: BtrTrend[] = []
  for (const rows of groups.values()) {
    const first = rows[0]!
    const exercise = first.exercise as BtrExercise
    // 一覧にない種目（消した種目の記録など）は出さない。
    if (!ORDER.has(exercise)) continue

    const lowerIsBetter = first.lowerIsBetter
    const points = rows.map((row) => ({ date: row.localDate, score: row.score }))
    const scores = points.map((point) => point.score)
    const level = currentLevel(exercise, rows)

    trends.push({
      exercise,
      variant: first.variant,
      name: displayName(exercise, first.variant),
      level,
      levelLabel: levelLabel(exercise, level),
      latest: scores[scores.length - 1] ?? null,
      best:
        scores.length === 0 ? null : lowerIsBetter ? Math.min(...scores) : Math.max(...scores),
      lowerIsBetter,
      points: points.slice(-maxPoints),
      direction: trendDirection(points, lowerIsBetter),
      attempts: rows.length,
    })
  }

  return trends.sort(
    (a, b) =>
      (ORDER.get(a.exercise) ?? 0) - (ORDER.get(b.exercise) ?? 0) ||
      (a.variant ?? '').localeCompare(b.variant ?? ''),
  )
}

/**
 * 読書の伸び。
 *
 * 「入会時の何倍になったか」は **倍速読書の記録だけ**で測る。
 * 普通読書と混ぜると、速く読もうとした日の数字がふだんの速さとして残り、
 * 伸びたのか、その日がんばっただけなのかが分からなくなる。
 */
export interface ReadingSpeedSummary {
  /** 入会時の速度。Baseline 未測定なら null。 */
  readonly baselineCpm: number | null
  /** 倍速読書の分速。古い順。 */
  readonly paced: readonly BtrPoint[]
  /** 普通読書の分速。古い順。 */
  readonly normal: readonly BtrPoint[]
  /** 直近の倍速読書。記録がなければ null。 */
  readonly latestPacedCpm: number | null
  readonly progress: ReadingProgress | null
}

export function summarizeReadingSpeed(
  results: readonly BtrRecordLike[],
  baselineCpm: number | null,
): ReadingSpeedSummary {
  const collect = (exercise: BtrExercise): BtrPoint[] =>
    results
      .filter((result) => result.exercise === exercise)
      .flatMap((result) =>
        result.cpm === null || result.cpm <= 0
          ? []
          : [{ date: result.localDate, score: result.cpm }],
      )

  const paced = collect('paced_reading')
  const normal = collect('normal_reading')
  const latestPacedCpm = paced[paced.length - 1]?.score ?? null

  return {
    baselineCpm,
    paced,
    normal,
    latestPacedCpm,
    progress:
      baselineCpm === null || baselineCpm <= 0 || latestPacedCpm === null
        ? null
        : measureProgress(baselineCpm, latestPacedCpm),
  }
}

/**
 * 続けている日数。
 *
 * 今日まだやっていない日を切らしたことにしない。夜にやる人が朝に開いたときに
 * 0 と出ると、続いていたものが切れたように見える。今日か昨日に記録があれば
 * そこから数えはじめる。
 */
export function trainingStreak(
  results: readonly BtrRecordLike[],
  today: LocalDate,
): number {
  const days = new Set(results.map((result) => result.localDate as string))
  if (days.size === 0) return 0

  const start = new Date(`${today}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) return 0

  const at = (offset: number): string => {
    const date = new Date(start)
    date.setUTCDate(date.getUTCDate() - offset)
    return date.toISOString().slice(0, 10)
  }

  // 今日やっていなければ昨日から数える。
  let offset = days.has(at(0)) ? 0 : 1
  if (!days.has(at(offset))) return 0

  let streak = 0
  while (days.has(at(offset))) {
    streak += 1
    offset += 1
  }
  return streak
}

/** 直近の1回ぶんの記録（同じ日の同じセッション）。 */
export function latestSession(
  results: readonly BtrRecordLike[],
): { date: LocalDate; records: readonly BtrRecordLike[] } | null {
  const last = results[results.length - 1]
  if (last === undefined) return null
  return {
    date: last.localDate,
    records: results.filter((result) => result.localDate === last.localDate),
  }
}
