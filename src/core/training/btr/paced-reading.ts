/**
 * 倍速読書（BTRメソッド 仕上げ）
 *
 * **自分の本**を読み、読んだページ数と時間を記録する。
 * 用意された教材ではなく実際の本を使うのがこの種目の要点である。
 *
 * 本を登録するときに **1ページあたりの文字数** を入れてもらい、
 * ページ数から字数を出す。本が変わったら登録し直す。
 *
 * ここと Baseline 測定だけが CPM を持つ。他の種目では速度を使わない。
 */

export const PACED_READING = {
  /** 1ページの文字数として受け付ける範囲。文庫は600前後、単行本は700〜900あたり。 */
  minCharsPerPage: 100,
  maxCharsPerPage: 3000,
  /** 目標。入会時の3倍を目指す、というスクールの方針に合わせる。 */
  targetMultiplier: 3,
} as const

export interface ReadingBook {
  readonly id: string
  readonly title: string
  /** 1ページあたりの文字数。登録時に入力する。 */
  readonly charsPerPage: number
  readonly createdAt: string
  /** 読み終えた日。読み切っていなければ null。 */
  readonly finishedAt: string | null
}

export interface PacedReadingInput {
  readonly charsPerPage: number
  /** 読んだページ数 */
  readonly pages: number
  readonly elapsedMs: number
}

export interface PacedReadingResult {
  readonly pages: number
  readonly characters: number
  readonly elapsedMs: number
  /** 1分あたりのページ数 */
  readonly pagesPerMinute: number
  /** 1分あたりの文字数。これが主スコア。 */
  readonly cpm: number
  /** 記録として妥当か。短すぎる測定や桁の外れた入力を弾く。 */
  readonly valid: boolean
}

/** 1ページの文字数として受け付けられる値か。 */
export function isValidCharsPerPage(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= PACED_READING.minCharsPerPage &&
    value <= PACED_READING.maxCharsPerPage
  )
}

export function scorePacedReading(input: PacedReadingInput): PacedReadingResult {
  const { charsPerPage, pages, elapsedMs } = input
  const minutes = elapsedMs / 60_000
  const characters = Math.max(0, Math.round(pages * charsPerPage))

  const pagesPerMinute = minutes <= 0 ? 0 : Math.round((pages / minutes) * 10) / 10
  const cpm = minutes <= 0 ? 0 : Math.round(characters / minutes)

  return {
    pages,
    characters,
    elapsedMs,
    pagesPerMinute,
    cpm,
    valid: pages > 0 && elapsedMs > 0 && isValidCharsPerPage(charsPerPage),
  }
}

export interface ReadingProgress {
  /** 入会時の速度（Baseline） */
  readonly baselineCpm: number
  /** 直近の倍速読書の速度 */
  readonly currentCpm: number
  /** 入会時の何倍か */
  readonly multiplier: number
  /** 目標（3倍）に対する到達率（0–100） */
  readonly towardTarget: number
  readonly reachedTarget: boolean
}

/**
 * 入会時の何倍になったか。
 *
 * 「1分で1冊」のような数字を出さないため、比較の相手は常に自分の Baseline にする。
 */
export function measureProgress(baselineCpm: number, currentCpm: number): ReadingProgress {
  if (baselineCpm <= 0) {
    return {
      baselineCpm,
      currentCpm,
      multiplier: 0,
      towardTarget: 0,
      reachedTarget: false,
    }
  }

  // 判定は丸める前の値で行う。丸めてから比べると 2.9975 倍が「3倍到達」になってしまう。
  const ratio = currentCpm / baselineCpm

  return {
    baselineCpm,
    currentCpm,
    multiplier: Math.round(ratio * 100) / 100,
    towardTarget: Math.min(
      100,
      Math.max(0, Math.round((ratio / PACED_READING.targetMultiplier) * 100)),
    ),
    reachedTarget: ratio >= PACED_READING.targetMultiplier,
  }
}
