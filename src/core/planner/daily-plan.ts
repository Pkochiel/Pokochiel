import { PLAN } from '../config/training-config'
import { assessWeakness, type MeasuredAxes } from '../adaptive/weakness'
import type { ChunkLevel, Difficulty, LocalDate, PlanDuration } from '../types/common'
import type { DailyTrainingPlan, PlanBlock, PlanReason, SkillRadar } from '../types/plan'
import type { TrainingPassage } from '../types/passage'
import type { TrainingType } from '../types/training'

export interface PassageCandidate {
  id: string
  difficulty: Difficulty
  characterCount: number
}

export interface GenerateDailyPlanInput {
  date: LocalDate
  totalMinutes: PlanDuration
  radar: SkillRadar
  /** 実測済みの軸。未実測の軸は弱点判定に使わない。 */
  measuredAxes?: MeasuredAxes
  /** 選択候補。定義順が安定していれば結果も安定する。 */
  passages: readonly PassageCandidate[]
  /** 直近で使った教材。原則として再利用しない。 */
  recentPassageIds: readonly string[]
  /** 実施待ちの翌日 Recall の件数 */
  dueRecallCount: number
  targetCpm: number | null
  chunkLevel: ChunkLevel
  /** 教材の難易度の目安 */
  preferredDifficulty: Difficulty
  userId: string
  createdAt: string
  planId: string
}

/** ベース配分の並び順。同点時の解決にも使う。 */
const BLOCK_ORDER: TrainingType[] = [
  'warmup',
  'speed_push',
  'chunk_reading',
  'structure_reading',
  'comprehension',
  'immediate_recall',
]

/** 教材を必要とするブロック（Comprehension と Recall は Structure と同じ教材を共有する）。 */
const NEEDS_OWN_PASSAGE: TrainingType[] = ['warmup', 'speed_push', 'chunk_reading']
const SHARES_STRUCTURE_PASSAGE: TrainingType[] = [
  'structure_reading',
  'comprehension',
  'immediate_recall',
]

type Allocation = Map<TrainingType, number>

function baseAllocation(totalMinutes: PlanDuration): Allocation {
  return new Map(
    Object.entries(PLAN.presets[totalMinutes]).map(([type, minutes]) => [
      type as TrainingType,
      minutes,
    ]),
  )
}

/**
 * 弱点ブロックへ時間を移す。
 * 合計時間は変えず、各ブロックが blockMinMinutes を下回らない範囲でのみ動かす。
 */
function reallocate(
  allocation: Allocation,
  emphasize: readonly TrainingType[],
  totalMinutes: number,
): Allocation {
  const result = new Map(allocation)
  const floorFor = (type: TrainingType) =>
    Math.max(
      PLAN.blockMinMinutes,
      Math.ceil((allocation.get(type) ?? 0) * PLAN.donorRetentionRatio),
    )
  const targets = emphasize.filter((type) => result.has(type))
  if (targets.length === 0) return result

  let budget = Math.floor(totalMinutes * PLAN.reallocationRatio)

  // 供出元は「強調対象でない」ブロックのうち、割り当てが大きい順
  const donors = BLOCK_ORDER.filter((type) => result.has(type) && !targets.includes(type)).sort(
    (a, b) =>
      (result.get(b) ?? 0) - (result.get(a) ?? 0) || BLOCK_ORDER.indexOf(a) - BLOCK_ORDER.indexOf(b),
  )
  if (donors.length === 0) return result

  // 1つのブロックを空にしないよう、供出元を順に1分ずつ回して集める。
  // 特定のトレーニングだけが消えると、日々の構成そのものが崩れるため。
  let targetIndex = 0
  let donorIndex = 0
  let consecutiveSkips = 0
  while (budget > 0 && consecutiveSkips < donors.length) {
    const donor = donors[donorIndex % donors.length]
    donorIndex += 1
    if (!donor || (result.get(donor) ?? 0) <= floorFor(donor)) {
      consecutiveSkips += 1
      continue
    }
    const receiver = targets[targetIndex % targets.length]
    if (!receiver) break
    result.set(donor, (result.get(donor) ?? 0) - 1)
    result.set(receiver, (result.get(receiver) ?? 0) + 1)
    budget -= 1
    targetIndex += 1
    consecutiveSkips = 0
  }

  return result
}

/** 難易度が目標に近く、直近で使っていない教材を順に選ぶ。 */
function pickPassages(
  passages: readonly PassageCandidate[],
  recentPassageIds: readonly string[],
  preferredDifficulty: Difficulty,
  count: number,
): string[] {
  const recent = new Set(recentPassageIds)
  const sorted = [...passages].sort((a, b) => {
    const usedA = recent.has(a.id) ? 1 : 0
    const usedB = recent.has(b.id) ? 1 : 0
    if (usedA !== usedB) return usedA - usedB
    const diffA = Math.abs(a.difficulty - preferredDifficulty)
    const diffB = Math.abs(b.difficulty - preferredDifficulty)
    if (diffA !== diffB) return diffA - diffB
    return a.id.localeCompare(b.id)
  })
  return sorted.slice(0, count).map((p) => p.id)
}

/**
 * 当日のトレーニング構成を生成する。
 *
 * 同じ入力からは常に同じ構成が出る（決定的）。乱数を使わないため、
 * テストで固定でき、ユーザーから見ても構成が理由なく揺れない。
 */
export function generateDailyPlan(input: GenerateDailyPlanInput): DailyTrainingPlan {
  const weakness = assessWeakness(input.radar, input.measuredAxes)
  const allocation = reallocate(
    baseAllocation(input.totalMinutes),
    weakness.emphasize,
    input.totalMinutes,
  )

  // 教材は「独自に必要な数 + 構造読解で共有する1本」
  const picked = pickPassages(
    input.passages,
    input.recentPassageIds,
    input.preferredDifficulty,
    NEEDS_OWN_PASSAGE.length + 1,
  )
  const sharedPassageId = picked[NEEDS_OWN_PASSAGE.length]

  const blocks: PlanBlock[] = []
  let order = 1

  if (input.dueRecallCount > 0) {
    blocks.push({
      order: order++,
      type: 'delayed_recall',
      minutes: PLAN.delayedRecallMinutes,
      reason: '昨日読んだ文章の想起から始めます',
    })
  }

  for (const type of BLOCK_ORDER) {
    const minutes = allocation.get(type)
    if (minutes === undefined || minutes <= 0) continue

    const ownIndex = NEEDS_OWN_PASSAGE.indexOf(type)
    const passageId =
      ownIndex >= 0
        ? picked[ownIndex]
        : SHARES_STRUCTURE_PASSAGE.includes(type)
          ? sharedPassageId
          : undefined

    blocks.push({
      order: order++,
      type,
      minutes,
      ...(passageId ? { passageId } : {}),
      ...(type === 'speed_push' && input.targetCpm ? { targetCpm: input.targetCpm } : {}),
      ...(type === 'warmup' && input.targetCpm ? { targetCpm: input.targetCpm } : {}),
      ...(type === 'chunk_reading' ? { chunkLevel: input.chunkLevel } : {}),
      ...(weakness.emphasize.includes(type) ? { reason: '弱点に合わせて配分を増やしています' } : {}),
    })
  }

  const generatedReason: PlanReason = {
    weakestSkills: weakness.ranked.slice(0, 2),
    notes: weakness.notes,
  }

  return {
    id: input.planId,
    userId: input.userId,
    planDate: input.date,
    totalMinutes: input.totalMinutes,
    blocks,
    targetCpm: input.targetCpm,
    chunkLevel: input.chunkLevel,
    generatedReason,
    completedAt: null,
    createdAt: input.createdAt,
  }
}

/** 教材から選択候補を作る。 */
export function toCandidates(passages: readonly TrainingPassage[]): PassageCandidate[] {
  return passages.map((p) => ({
    id: p.id,
    difficulty: p.difficulty,
    characterCount: p.characterCount,
  }))
}
