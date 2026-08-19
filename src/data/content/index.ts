import type { Difficulty, PassageCategory, TrainingPassage } from '@/core/types'
import { BUSINESS_PASSAGES } from './passages/business'
import { ECONOMICS_PASSAGES } from './passages/economics'
import { GENERAL_PASSAGES } from './passages/general'
import { HISTORY_PASSAGES } from './passages/history'
import { PSYCHOLOGY_PASSAGES } from './passages/psychology'
import { SCIENCE_PASSAGES } from './passages/science'
import { TECHNOLOGY_PASSAGES } from './passages/technology'

/**
 * Seed 教材の一覧。
 * 将来はここに取り込み教材・生成教材を合流させる（ContentProvider 化の予定地）。
 */
export const ALL_PASSAGES: readonly TrainingPassage[] = [
  ...BUSINESS_PASSAGES,
  ...TECHNOLOGY_PASSAGES,
  ...ECONOMICS_PASSAGES,
  ...PSYCHOLOGY_PASSAGES,
  ...SCIENCE_PASSAGES,
  ...HISTORY_PASSAGES,
  ...GENERAL_PASSAGES,
]

const BY_ID = new Map(ALL_PASSAGES.map((p) => [p.id, p]))

export function getPassageById(id: string): TrainingPassage | null {
  return BY_ID.get(id) ?? null
}

/** Baseline Test で使う教材。難易度は中間、長さは 3 分程度で読み切れる分量。 */
export const BASELINE_PASSAGE_ID = 'gen-006'

export function getBaselinePassage(): TrainingPassage {
  const passage = getPassageById(BASELINE_PASSAGE_ID)
  if (!passage) throw new Error(`Baseline passage not found: ${BASELINE_PASSAGE_ID}`)
  return passage
}

export interface PassageQuery {
  difficulty?: Difficulty
  category?: PassageCategory
  /** 直近で使った教材を除外する */
  excludeIds?: readonly string[]
}

/**
 * 条件に合う教材を返す。順序は ALL_PASSAGES の定義順で安定している
 * （同じ入力からは常に同じ結果になり、テストで固定できる）。
 */
export function queryPassages(query: PassageQuery = {}): TrainingPassage[] {
  const excluded = new Set(query.excludeIds ?? [])
  return ALL_PASSAGES.filter((p) => {
    if (excluded.has(p.id)) return false
    if (query.category && p.category !== query.category) return false
    if (query.difficulty && p.difficulty !== query.difficulty) return false
    return true
  })
}

/**
 * 目標難易度に最も近い教材を1本選ぶ。
 * 完全一致がなければ難易度差の小さいものを選び、それでも同点なら定義順で決める。
 */
export function selectPassage(
  targetDifficulty: Difficulty,
  options: { excludeIds?: readonly string[]; category?: PassageCategory } = {},
): TrainingPassage | null {
  const candidates = queryPassages({
    ...(options.category ? { category: options.category } : {}),
    ...(options.excludeIds ? { excludeIds: options.excludeIds } : {}),
  })
  if (candidates.length === 0) return null
  return candidates.reduce((best, current) =>
    Math.abs(current.difficulty - targetDifficulty) < Math.abs(best.difficulty - targetDifficulty)
      ? current
      : best,
  )
}
