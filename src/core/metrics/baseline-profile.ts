import type { BaselineProfile } from '../types/profile'
import type { QuestionType } from '../types/passage'
import type { ReadingTest } from '../types/training'
import { calculateCpm } from './cpm'

/** 奇数個なら中央、偶数個なら中央2つの平均。 */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? null
  const lower = sorted[middle - 1]
  const upper = sorted[middle]
  return lower === undefined || upper === undefined ? null : (lower + upper) / 2
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

/** 測定として有効な Baseline だけを残す。 */
export function validBaselineTests(tests: readonly ReadingTest[]): ReadingTest[] {
  return tests.filter((test) => {
    if (!test.isBaseline) return false
    const { valid } = calculateCpm({
      characterCount: test.characterCount,
      elapsedSeconds: test.elapsedSeconds,
    })
    return valid
  })
}

const typeValue = (test: ReadingTest, type: QuestionType): number | null =>
  test.typeScores?.[type] ?? null

/**
 * Baseline Profile を組み立てる。
 *
 * CPM は平均ではなく中央値を採る。1回だけ極端に速い／遅い測定が混じっても、
 * 以降のトレーニング全体の基準がそれに引きずられないようにするため。
 * 理解の内訳（Main Idea / Cause & Effect / Structure）と想起は平均でよい。
 * これらは1回の測定でも 0〜100 の範囲に収まり、外れ値の影響が小さいため。
 */
export function computeBaselineProfile(tests: readonly ReadingTest[]): BaselineProfile {
  const valid = validBaselineTests(tests).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const collect = (read: (test: ReadingTest) => number | null): number[] =>
    valid.flatMap((test) => {
      const value = read(test)
      return value === null ? [] : [value]
    })

  const cpmValues = collect((test) => test.cpm)
  const cpm = median(cpmValues)

  return {
    cpm: cpm === null ? null : Math.round(cpm),
    comprehension: mean(collect((test) => test.comprehensionScore)),
    mainIdea: mean(collect((test) => typeValue(test, 'main_idea'))),
    causeEffect: mean(collect((test) => typeValue(test, 'cause_effect'))),
    structure: mean(collect((test) => typeValue(test, 'structure'))),
    immediateRecall: mean(collect((test) => test.recallScore)),
    attempts: valid.length,
    updatedAt: valid[valid.length - 1]?.createdAt ?? null,
  }
}
