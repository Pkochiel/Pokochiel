export interface ErsInput {
  cpm: number | null
  /** 0–100 */
  comprehensionScore: number | null
  /** 0–100 */
  recallScore: number | null
}

/**
 * Effective Reading Score（実験的な指標）
 *
 *   ERS = CPM × comprehension(0–1) × recall(0–1)
 *
 * 速度単独の指標にしないための複合値であり、絶対的な能力指数ではない。
 * UI では必ず内訳（CPM / 理解 / 想起）と併記する。
 *
 * 欠損は 0 や 1 で埋めない。埋めると「理解度を測っていない速い読書」が
 * 高いスコアとして残り、指標の意味が壊れるため、null を返す。
 */
export function calculateErs({ cpm, comprehensionScore, recallScore }: ErsInput): number | null {
  if (cpm === null || comprehensionScore === null || recallScore === null) return null
  return Math.round(cpm * (comprehensionScore / 100) * (recallScore / 100))
}

/**
 * 翌日想起で算出する保持後の ERS。
 * 当日確定する ERS とは別指標として扱う。
 */
export function calculateRetainedErs(input: {
  cpm: number | null
  comprehensionScore: number | null
  delayedRecallScore: number | null
}): number | null {
  return calculateErs({
    cpm: input.cpm,
    comprehensionScore: input.comprehensionScore,
    recallScore: input.delayedRecallScore,
  })
}
