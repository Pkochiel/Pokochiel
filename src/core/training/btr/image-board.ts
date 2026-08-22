/**
 * イメージボード（BTRメソッド 読書内容への集中）
 *
 * 40個の単語を制限時間内に覚え、思い出せたものを答える。
 * **同じ単語で2セット**行う。1セット目で取りこぼしたものが2セット目で拾えるかを見る。
 * 級が上がるごとに制限時間が短くなる。
 *
 * イメージ記憶とは別の種目である。
 * イメージ記憶は上下に並んだ2語を結ぶイメージを作るが、こちらは40語の並びをそのまま覚える。
 */

export const IMAGE_BOARD = {
  /** 1回に出す単語数 */
  wordCount: 40,
  /** 同じ単語で行うセット数 */
  sets: 2,
  /**
   * 制限時間の段階（ms）。級が上がるごとに短くなる。
   * 初級は2分。イメージ記憶と同じ詰め方に揃えている。
   */
  timeLimits: [120_000, 90_000, 60_000, 45_000, 30_000],
  /**
   * 次の段へ上がる正答数（2セット合計に対する割合ではなく、1セットの再生数）。
   * イメージ記憶が40語中36点で次の段へ進むのに合わせている。
   */
  advanceRecalled: 36,
  /** ひとつ前の段へ戻る再生数 */
  fallbackRecalled: 24,
} as const

export interface ImageBoardSet {
  /** 何セット目か（0 始まり） */
  readonly index: number
  /** 再生できた単語 */
  readonly recalled: readonly string[]
}

export interface ImageBoardSetResult {
  readonly index: number
  /** 正しく再生できた数 */
  readonly recalled: number
  /** 出題になかった単語を挙げた数 */
  readonly intruded: number
  readonly total: number
}

export interface ImageBoardResult {
  /** 各セットの再生数。記録にはこの並びを残す。 */
  readonly attempts: readonly number[]
  readonly sets: readonly ImageBoardSetResult[]
  /**
   * 主スコア。**2セットのうち良いほう**を採る。
   * 合計にすると同じ単語を2回数えることになり、覚えられた語数を表さない。
   */
  readonly score: number
  /** 2セットのどちらかで再生できた語の数。取りこぼしの回復を見る。 */
  readonly unionRecalled: number
  readonly total: number
}

/** 表記ゆれを吸収して突き合わせる。前後の空白と全角空白だけ落とす。 */
function normalize(word: string): string {
  return word.trim().replace(/[\s　]+/g, '')
}

export function scoreImageBoard(
  words: readonly string[],
  sets: readonly ImageBoardSet[],
): ImageBoardResult {
  const answerKey = new Set(words.map(normalize))
  const union = new Set<string>()

  const results = sets.map((set): ImageBoardSetResult => {
    // 同じ語を並べても1回として数える。
    const unique = new Set(set.recalled.map(normalize))
    let recalled = 0
    let intruded = 0

    for (const word of unique) {
      if (word.length === 0) continue
      if (answerKey.has(word)) {
        recalled += 1
        union.add(word)
      } else {
        intruded += 1
      }
    }

    return { index: set.index, recalled, intruded, total: words.length }
  })

  return {
    attempts: results.map((result) => result.recalled),
    sets: results,
    score: results.reduce((best, result) => Math.max(best, result.recalled), 0),
    unionRecalled: union.size,
    total: words.length,
  }
}
