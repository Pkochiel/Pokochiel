import type { Difficulty, PassageCategory, TrainingPassage } from '@/core/types'
import { BASELINE_PASSAGES } from './passages/baseline'
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

/**
 * Baseline Test 専用の教材。トレーニング用のプール（ALL_PASSAGES）とは分離する。
 * 訓練で先に読んだ文章で測定すると、記憶によってスコアが押し上げられるため。
 */
export const BASELINE_POOL: readonly TrainingPassage[] = BASELINE_PASSAGES

const BASELINE_BY_ID = new Map(BASELINE_POOL.map((p) => [p.id, p]))

export function getBaselinePassageById(id: string): TrainingPassage | null {
  return BASELINE_BY_ID.get(id) ?? null
}

/**
 * 次の Baseline に使う教材を選ぶ。
 *
 * 未使用のものを優先し、すべて使い切っていたら最も古く使ったものへ戻る。
 * 同じ入力からは常に同じ教材が返る（測定条件を再現できるようにするため）。
 */
export function selectBaselinePassage(usedIds: readonly string[] = []): TrainingPassage {
  const unused = BASELINE_POOL.filter((p) => !usedIds.includes(p.id))
  const pool = unused.length > 0 ? unused : BASELINE_POOL
  const first = pool[0]
  if (!first) throw new Error('Baseline passage pool is empty')
  if (unused.length > 0) return first

  // 使い切っている場合は、最も過去に使ったものから順に回す
  const oldest = [...BASELINE_POOL].sort(
    (a, b) => usedIds.indexOf(a.id) - usedIds.indexOf(b.id),
  )[0]
  return oldest ?? first
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
