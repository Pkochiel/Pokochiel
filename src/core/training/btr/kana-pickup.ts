/**
 * かなひろい（BTRメソッド 読書内容への集中）
 *
 * **物語文を読みながら「あ・い・う・え・お」に印をつけ、終了後に内容を確認する。**
 * 一般に「かなひろいテスト」として知られる選択的抹消課題である。
 *
 * この種目の要点は、拾うことそのものではなく **拾いながら読めるか** にある。
 * 拾うだけなら字面を走らせれば数は出るし、読むだけなら拾い落とす。
 * 二つを同時に保てるかを見る訓練なので、**拾い数と内容正答は必ず並べて記録する。**
 * 片方だけを見ると、もう片方を捨てた人が上位に出る。
 *
 * 制限時間は2分で固定する。他の種目のように時間を詰めていく方式にしないのは、
 * 課題文が2分では読み切れない長さだからで、どこまで進めたかがそのまま成績になる。
 * 級は拾い数で判定する（スピードボードやユニットブックと同じ形）。
 */

export const KANA_PICKUP = {
  /** 拾う文字 */
  targets: ['あ', 'い', 'う', 'え', 'お'],
  /** 制限時間（ms）。2分。級が上がっても短くしない。 */
  durationMs: 120_000,
  /**
   * 次の段へ上がる条件。**両方**を満たしたときだけ上がる。
   * 拾い率だけにすると内容を捨てた人が上がってしまい、この種目の意味がなくなる。
   */
  advanceFoundRatio: 90,
  advanceComprehension: 75,
  /** ひとつ前の段へ戻る拾い率（%） */
  fallbackFoundRatio: 60,
  /**
   * 内容確認で出す問いの数。読んだ範囲に問いが足りなければ、あるだけになる。
   *
   * この数は暫定である。教室が何問訊いているかは確認できていない。
   * 多くすると2分の抹消より確認のほうが長くなり、少なくすると
   * 当てずっぽうで正答率が跳ねる。その間を取った。
   */
  questionCount: 4,
} as const

const TARGET_SET = new Set<string>(KANA_PICKUP.targets)

export function isKanaTarget(char: string): boolean {
  return TARGET_SET.has(char)
}

export interface KanaChar {
  /** 本文の先頭から数えた位置。押した記録はこの番号で持つ。 */
  readonly index: number
  readonly char: string
  readonly target: boolean
  /** 何行目にあるか（0 始まり） */
  readonly line: number
}

export interface KanaLine {
  readonly index: number
  readonly chars: readonly KanaChar[]
}

export interface KanaSheet {
  readonly lines: readonly KanaLine[]
  readonly chars: readonly KanaChar[]
  /** 本文全体にある対象の数 */
  readonly targetCount: number
}

/**
 * 課題文を1文字ずつに開く。
 *
 * 押せるようにするだけなら対象の字だけを部品にすれば足りるが、それだと
 * 対象でない字を押した記録が取れない。拾い間違いも成績のうちなので全文字を持つ。
 */
export function buildKanaSheet(lines: readonly string[]): KanaSheet {
  const chars: KanaChar[] = []
  const built: KanaLine[] = lines.map((text, line) => {
    const lineChars = [...text].map((char) => {
      const item: KanaChar = { index: chars.length, char, target: isKanaTarget(char), line }
      chars.push(item)
      return item
    })
    return { index: line, chars: lineChars }
  })

  return {
    lines: built,
    chars,
    targetCount: chars.filter((char) => char.target).length,
  }
}

export interface ReadingFront {
  /** 押した中でいちばん後ろの位置。押していなければ -1。 */
  readonly charIndex: number
  /** そこまでに読み終えたとみなす行。読んでいなければ -1。 */
  readonly line: number
}

/**
 * どこまで読み進めたか。
 *
 * 押した位置のいちばん後ろを読んだ先端とみなす。対象を拾わずに読み飛ばした分は
 * 数えられないので実際よりやや手前に出るが、内容確認の範囲を決めるには
 * 手前に外れるほうが安全である（読んでいない箇所を訊いてしまうより良い）。
 */
export function readingFront(sheet: KanaSheet, picked: readonly number[]): ReadingFront {
  let charIndex = -1
  for (const index of picked) {
    const char = sheet.chars[index]
    if (char !== undefined && index > charIndex) charIndex = index
  }
  if (charIndex < 0) return { charIndex: -1, line: -1 }
  return { charIndex, line: sheet.chars[charIndex]!.line }
}

export interface KanaComprehension {
  readonly asked: number
  readonly correct: number
  /** 正答率（%） */
  readonly ratio: number
}

export interface KanaPickupResult {
  /** 主スコア。読んだ範囲で拾えた数。 */
  readonly score: number
  readonly found: number
  /** 読んだ範囲にありながら拾えなかった数 */
  readonly missed: number
  /** 対象でない字を押した回数 */
  readonly wrong: number
  /** 読んだ範囲にあった対象の数 */
  readonly reachedTargets: number
  /** 本文全体の対象の数 */
  readonly totalTargets: number
  /** 読み終えた行（0 始まり）。読んでいなければ -1。 */
  readonly reachedLine: number
  /** 本文の行数 */
  readonly totalLines: number
  /** 読んだ範囲での拾い率（%） */
  readonly foundRatio: number
  /**
   * 内容確認の成績。読んだ範囲に確認できる問いがなければ null。
   * 読んでいない箇所を訊かない代わりに、成績が出ない回がありうる。
   */
  readonly comprehension: KanaComprehension | null
}

export function scoreKanaPickup(
  sheet: KanaSheet,
  picked: readonly number[],
  comprehension?: { readonly asked: number; readonly correct: number },
): KanaPickupResult {
  // 同じ字を二度押しても1回として数える。
  const unique = new Set(picked.filter((index) => sheet.chars[index] !== undefined))
  const front = readingFront(sheet, picked)

  let found = 0
  let wrong = 0
  for (const index of unique) {
    if (sheet.chars[index]!.target) found += 1
    else wrong += 1
  }

  // 読んだ範囲だけで拾い率を出す。まだ来ていない先を見落としに数えない。
  const reachedTargets = sheet.chars.filter(
    (char) => char.target && char.index <= front.charIndex,
  ).length

  return {
    score: found,
    found,
    missed: Math.max(0, reachedTargets - found),
    wrong,
    reachedTargets,
    totalTargets: sheet.targetCount,
    reachedLine: front.line,
    totalLines: sheet.lines.length,
    foundRatio: reachedTargets === 0 ? 0 : Math.round((found / reachedTargets) * 100),
    comprehension:
      comprehension === undefined || comprehension.asked <= 0
        ? null
        : {
            asked: comprehension.asked,
            correct: comprehension.correct,
            ratio: Math.round((comprehension.correct / comprehension.asked) * 100),
          },
  }
}

export type KanaJudgement = 'advance' | 'stay' | 'fallback'

/**
 * 級の判定。
 *
 * 上がるには拾い率と内容正答の両方が要る。内容確認が出せなかった回は上げない。
 * 拾えていても読めていなかった可能性を消せないので、据え置きにする。
 */
export function judgeKanaPickup(result: KanaPickupResult): KanaJudgement {
  if (result.reachedTargets === 0) return 'stay'
  if (result.foundRatio < KANA_PICKUP.fallbackFoundRatio) return 'fallback'
  if (
    result.foundRatio >= KANA_PICKUP.advanceFoundRatio &&
    result.comprehension !== null &&
    result.comprehension.ratio >= KANA_PICKUP.advanceComprehension
  ) {
    return 'advance'
  }
  return 'stay'
}
