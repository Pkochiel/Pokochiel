/**
 * 読書（BTRメソッド 仕上げ）
 *
 * **自分の本**を読み、読んだページ数と時間を記録する。
 * 用意された教材ではなく実際の本を使うのがこの種目の要点である。
 *
 * 読書には2つある。
 *
 *   普通読書  いつもの読み方で読む。いまの自分の速さを測る
 *   倍速読書  意識して速く読む。訓練にあたる
 *
 * 2つを分けて記録するのが肝心である。ひとつにまとめると、
 * 「速く読もうとしたときの数字」と「ふだんの数字」が混ざり、
 * 伸びているのか、その日がんばっただけなのかが分からなくなる。
 *
 * 本を登録するときに **1ページあたりの文字数** を入れてもらい、
 * ページ数から字数を出す。本が変わったら登録し直す。
 *
 * ここと Baseline 測定だけが CPM を持つ。他の種目では速度を使わない。
 */

/** 読み方。記録は必ずどちらかに分ける。 */
export type ReadingMode = 'normal' | 'paced'

export const READING_MODE_LABELS: Record<ReadingMode, string> = {
  normal: '普通読書',
  paced: '倍速読書',
}

export const PACED_READING = {
  /** 1ページの文字数として受け付ける範囲。文庫は600前後、単行本は700〜900あたり。 */
  minCharsPerPage: 100,
  maxCharsPerPage: 3000,
  /** 目標。入会時の3倍を目指す、というスクールの方針に合わせる。 */
  targetMultiplier: 3,
  /**
   * 読む時間（ms）。1回90分の配分に合わせる。
   *
   * 時間を決めて「何ページ読めたか」を測る。ページ数を決めて時間を測る形にすると、
   * 読み終わりの見えるページまで飛ばす人が出て、速度が水増しされる。
   */
  durationMs: { normal: 8 * 60_000, paced: 12 * 60_000 } satisfies Record<ReadingMode, number>,
  /**
   * 記録として受け付ける最短の測定時間（ms）。
   *
   * 読みはじめてすぐ止めると、わずかな時間が分母に来て分速が跳ねる。
   * 7ページを2秒で「読んだ」と入れれば毎分17万字になり、その一件だけで
   * 推移が読めなくなる。1分に満たない測定は速度ではない。
   */
  minElapsedMs: 60_000,
  /**
   * 記録として受け付ける分速の上限（字/分）。
   *
   * ページ数の打ち間違い（7を70と入れるなど）を止める。
   * 実在しうる速さより十分に高く置き、明らかな入力の事故だけを弾く。
   */
  maxCpm: 20_000,
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
  readonly mode: ReadingMode
  readonly charsPerPage: number
  /** 読んだページ数 */
  readonly pages: number
  readonly elapsedMs: number
}

export type ReadingRejection = 'too-short' | 'no-pages' | 'chars-per-page' | 'too-fast'

export const READING_REJECTION_MESSAGES: Record<ReadingRejection, string> = {
  'too-short':
    '測った時間が1分に足りません。短すぎる測定では分速が跳ねてしまうため、記録に残しません。',
  'no-pages': '読んだページ数が入っていません。',
  'chars-per-page': '1ページの文字数が桁外れです。本を登録し直してください。',
  'too-fast':
    'ページ数か時間の入力が合っていないようです。この速さは記録に残しません。',
}

export interface PacedReadingResult {
  readonly mode: ReadingMode
  readonly pages: number
  readonly characters: number
  readonly elapsedMs: number
  /** 1分あたりのページ数 */
  readonly pagesPerMinute: number
  /** 1分あたりの文字数。これが主スコア。 */
  readonly cpm: number
  /** 記録として妥当か。短すぎる測定や桁の外れた入力を弾く。 */
  readonly valid: boolean
  /** 妥当でないときの理由。妥当なら null。 */
  readonly rejection: ReadingRejection | null
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
  const { mode, charsPerPage, pages, elapsedMs } = input
  const minutes = elapsedMs / 60_000
  const characters = Math.max(0, Math.round(pages * charsPerPage))

  const pagesPerMinute = minutes <= 0 ? 0 : Math.round((pages / minutes) * 10) / 10
  const cpm = minutes <= 0 ? 0 : Math.round(characters / minutes)

  // 弾く理由は先に見つかったものを返す。直せる順に並べている。
  const rejection: ReadingRejection | null =
    pages <= 0
      ? 'no-pages'
      : !isValidCharsPerPage(charsPerPage)
        ? 'chars-per-page'
        : elapsedMs < PACED_READING.minElapsedMs
          ? 'too-short'
          : cpm > PACED_READING.maxCpm
            ? 'too-fast'
            : null

  return {
    mode,
    pages,
    characters,
    elapsedMs,
    pagesPerMinute,
    cpm,
    valid: rejection === null,
    rejection,
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
 * 倍速読書の記録だけで測る。普通読書と混ぜると、速く読もうとした日の数字が
 * ふだんの速さとして残ってしまう。
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
