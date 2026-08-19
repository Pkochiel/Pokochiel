import { CORE_TRAINING_SKILLS, PLAN } from '../config/training-config'
import {
  assessCoreEmphasis,
  selectOptionalTrainings,
  type OptionalTraining,
} from '../adaptive/training-selection'
import { rankSkillsByNeed } from '../metrics/skill-profile'
import type { ChunkLevel, Difficulty, LocalDate, PlanDuration } from '../types/common'
import type { DailyTrainingPlan, PlanBlock, PlanReason } from '../types/plan'
import type { TrainingPassage } from '../types/passage'
import type { SkillProfile } from '../types/skill'
import type { TrainingType } from '../types/training'

export interface PassageCandidate {
  id: string
  difficulty: Difficulty
  characterCount: number
  /** Prediction Reading に使える停止位置を持つか */
  supportsPrediction: boolean
  /** Variable Speed Reading の区間定義を持つか */
  supportsVariableSpeed: boolean
}

export interface GenerateDailyPlanInput {
  date: LocalDate
  totalMinutes: PlanDuration
  profile: SkillProfile
  passages: readonly PassageCandidate[]
  /** 直近で使った教材。原則として再利用しない。 */
  recentPassageIds: readonly string[]
  /** 実施待ちの翌日 Recall の件数 */
  dueRecallCount: number
  targetCpm: number | null
  chunkLevel: ChunkLevel
  meaningFlashLevel: ChunkLevel
  preferredDifficulty: Difficulty
  userId: string
  createdAt: string
  planId: string
}

/**
 * 画面に出す順序。
 * ウォームアップ → 速度 → 意味 → チャンク → 予測 → 構造 → 速度切替 → 理解 → 想起。
 * 認知処理の順序（視認 → 意味 → 構造 → 判断 → 想起）に沿って並べている。
 */
const BLOCK_SEQUENCE: TrainingType[] = [
  'delayed_recall',
  'warmup',
  'speed_push',
  'meaning_flash',
  'chunk_reading',
  'prediction_reading',
  'structure_reading',
  'variable_speed',
  'regression_control',
  'comprehension',
  'immediate_recall',
]

const CORE_TRAININGS = Object.keys(CORE_TRAINING_SKILLS) as TrainingType[]

/** 独自の教材が必要なブロック */
const NEEDS_OWN_PASSAGE: TrainingType[] = [
  'warmup',
  'speed_push',
  'chunk_reading',
  'prediction_reading',
  'variable_speed',
  'regression_control',
]

/** Structure Reading と同じ教材を共有するブロック（読んだものを問う） */
const SHARES_STRUCTURE_PASSAGE: TrainingType[] = [
  'structure_reading',
  'comprehension',
  'immediate_recall',
]

type Allocation = Map<TrainingType, number>

function coreAllocation(totalMinutes: PlanDuration): Allocation {
  return new Map(
    Object.entries(PLAN.core[totalMinutes]).map(([type, minutes]) => [
      type as TrainingType,
      minutes,
    ]),
  )
}

/**
 * コア側の時間を弱点へ寄せる。
 * 供出元はベース配分の半分を保持し、特定のトレーニングが実質消えないようにする。
 */
function reallocateCore(
  base: Allocation,
  emphasize: readonly TrainingType[],
  suppress: readonly TrainingType[],
  totalCoreMinutes: number,
): Allocation {
  const result = new Map(base)
  const targets = emphasize.filter((type) => result.has(type))
  if (targets.length === 0) return result

  const floorFor = (type: TrainingType) =>
    Math.max(
      PLAN.coreBlockMinMinutes,
      Math.ceil((base.get(type) ?? 0) * PLAN.donorRetentionRatio),
    )

  const donors = CORE_TRAININGS.filter(
    (type) => result.has(type) && !targets.includes(type),
  ).sort((a, b) => {
    // 「増やしてはいけない」ブロックから先に供出させる
    const suppressedA = suppress.includes(a) ? 0 : 1
    const suppressedB = suppress.includes(b) ? 0 : 1
    if (suppressedA !== suppressedB) return suppressedA - suppressedB
    return (result.get(b) ?? 0) - (result.get(a) ?? 0)
  })
  if (donors.length === 0) return result

  let budget = Math.floor(totalCoreMinutes * PLAN.coreReallocationRatio)
  let donorIndex = 0
  let targetIndex = 0
  let skips = 0

  while (budget > 0 && skips < donors.length) {
    const donor = donors[donorIndex % donors.length]
    donorIndex += 1
    if (!donor || (result.get(donor) ?? 0) <= floorFor(donor)) {
      skips += 1
      continue
    }
    const receiver = targets[targetIndex % targets.length]
    if (!receiver) break
    result.set(donor, (result.get(donor) ?? 0) - 1)
    result.set(receiver, (result.get(receiver) ?? 0) + 1)
    budget -= 1
    targetIndex += 1
    skips = 0
  }

  return result
}

/** 任意ブロックの予算を、選ばれたトレーニングへ均等に割る（端数は先頭から）。 */
function splitOptionalBudget(budget: number, count: number): number[] {
  if (count === 0 || budget <= 0) return []
  const maxBlocks = Math.min(count, Math.floor(budget / PLAN.optionalBlockMinMinutes))
  if (maxBlocks === 0) return []

  const minutes = Array.from({ length: maxBlocks }, () =>
    Math.min(PLAN.optionalBlockMaxMinutes, Math.floor(budget / maxBlocks)),
  )
  let remainder = budget - minutes.reduce((a, b) => a + b, 0)
  for (let i = 0; remainder > 0 && i < minutes.length; i += 1) {
    const room = PLAN.optionalBlockMaxMinutes - (minutes[i] ?? 0)
    const add = Math.min(room, remainder)
    minutes[i] = (minutes[i] ?? 0) + add
    remainder -= add
  }
  // 端数が残る場合は最後のブロックに寄せる（合計を必ず使い切る）
  const last = minutes.length - 1
  if (remainder > 0 && last >= 0) minutes[last] = (minutes[last] ?? 0) + remainder
  return minutes
}

interface PassagePlan {
  byTraining: Map<TrainingType, string>
}

function assignPassages(
  types: readonly TrainingType[],
  passages: readonly PassageCandidate[],
  recentPassageIds: readonly string[],
  preferredDifficulty: Difficulty,
): PassagePlan {
  const recent = new Set(recentPassageIds)
  const used = new Set<string>()

  const rank = (candidate: PassageCandidate) => {
    const usedRecently = recent.has(candidate.id) ? 1 : 0
    return usedRecently * 100 + Math.abs(candidate.difficulty - preferredDifficulty)
  }

  const sorted = [...passages].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))

  const take = (predicate: (candidate: PassageCandidate) => boolean): string | undefined => {
    const found = sorted.find((candidate) => !used.has(candidate.id) && predicate(candidate))
    if (found) used.add(found.id)
    return found?.id
  }

  const byTraining = new Map<TrainingType, string>()

  for (const type of types) {
    if (type === 'prediction_reading') {
      const id = take((c) => c.supportsPrediction)
      if (id) byTraining.set(type, id)
      continue
    }
    if (type === 'variable_speed') {
      const id = take((c) => c.supportsVariableSpeed)
      if (id) byTraining.set(type, id)
      continue
    }
    if (NEEDS_OWN_PASSAGE.includes(type)) {
      const id = take(() => true)
      if (id) byTraining.set(type, id)
      continue
    }
  }

  const sharedId = take(() => true) ?? byTraining.get('speed_push')
  if (sharedId) {
    for (const type of SHARES_STRUCTURE_PASSAGE) byTraining.set(type, sharedId)
  }

  return { byTraining }
}

/**
 * 当日のトレーニング構成を生成する。
 *
 * 毎日すべてのトレーニングを行うのではなく、コア + Skill Profile に応じた
 * 任意ブロックで構成する。合計時間は必ず totalMinutes に一致する。
 * 同じ入力からは常に同じ構成が出る（乱数を使わない）。
 */
export function generateDailyPlan(input: GenerateDailyPlanInput): DailyTrainingPlan {
  const emphasis = assessCoreEmphasis(input.profile)
  const core = coreAllocation(input.totalMinutes)
  const coreMinutes = [...core.values()].reduce((a, b) => a + b, 0)
  const allocation = reallocateCore(core, emphasis.emphasize, emphasis.suppress, coreMinutes)

  const hasPrediction = input.passages.some((p) => p.supportsPrediction)
  const hasVariableSpeed = input.passages.some((p) => p.supportsVariableSpeed)
  const available: OptionalTraining[] = (
    ['meaning_flash', 'chunk_reading', 'prediction_reading', 'variable_speed', 'regression_control'] as OptionalTraining[]
  ).filter((type) => {
    if (type === 'prediction_reading') return hasPrediction
    if (type === 'variable_speed') return hasVariableSpeed
    return true
  })

  const budget = PLAN.optionalBudget[input.totalMinutes]
  const maxBlocks = Math.floor(budget / PLAN.optionalBlockMinMinutes)
  const selected = selectOptionalTrainings({
    profile: input.profile,
    available,
    rotationSeed: input.date,
    limit: maxBlocks,
  })
  const optionalMinutes = splitOptionalBudget(budget, selected.length)
  const chosen = selected.slice(0, optionalMinutes.length)

  for (const [index, training] of chosen.entries()) {
    allocation.set(training.type, optionalMinutes[index] ?? PLAN.optionalBlockMinMinutes)
  }

  const activeTypes = BLOCK_SEQUENCE.filter((type) => (allocation.get(type) ?? 0) > 0)
  const passagePlan = assignPassages(
    activeTypes,
    input.passages,
    input.recentPassageIds,
    input.preferredDifficulty,
  )

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

  const chosenByType = new Map(chosen.map((c) => [c.type as TrainingType, c]))

  for (const type of BLOCK_SEQUENCE) {
    if (type === 'delayed_recall') continue
    const minutes = allocation.get(type)
    if (minutes === undefined || minutes <= 0) continue

    const passageId = passagePlan.byTraining.get(type)
    const optional = chosenByType.get(type)
    const reason = optional
      ? `${optional.reason}選びました`
      : emphasis.emphasize.includes(type)
        ? '弱点に合わせて配分を増やしています'
        : undefined

    blocks.push({
      order: order++,
      type,
      minutes,
      ...(passageId ? { passageId } : {}),
      ...((type === 'speed_push' || type === 'warmup' || type === 'regression_control') &&
      input.targetCpm
        ? { targetCpm: input.targetCpm }
        : {}),
      ...(type === 'chunk_reading' ? { chunkLevel: input.chunkLevel } : {}),
      ...(type === 'meaning_flash' ? { chunkLevel: input.meaningFlashLevel } : {}),
      ...(reason ? { reason } : {}),
    })
  }

  const ranked = rankSkillsByNeed(input.profile)
  const generatedReason: PlanReason = {
    weakestSkills: ranked.filter((m) => m.state === 'weak').map((m) => m.id),
    measuredForFirstTime: chosen
      .filter((c) => c.state === 'unmeasured')
      .map((c) => c.skill),
    notes:
      emphasis.notes.length > 0
        ? emphasis.notes
        : ['実績がまだ少ないため、標準の構成で測定を進めます'],
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
    supportsPrediction: p.paragraphs.some(
      (paragraph) => (paragraph.predictionStop?.choices?.length ?? 0) > 0,
    ),
    supportsVariableSpeed: (p.speedSegments?.length ?? 0) > 0,
  }))
}
