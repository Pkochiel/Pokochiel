import { describe, expect, it } from 'vitest'
import { MEANING_FLASH, QUESTIONS } from '@/core/config/training-config'
import { computeSkillProfile } from '@/core/metrics/skill-profile'
import {
  generateDailyPlan,
  type GenerateDailyPlanInput,
  type PassageCandidate,
} from '@/core/planner/daily-plan'
import {
  comprehensionQuestions,
  readCheckQuestions,
  structureProbeIndexes,
} from '@/core/training/question-set'
import type { PlanDuration } from '@/core/types/common'
import type { TrainingPassage } from '@/core/types/passage'
import type { PlanBlock } from '@/core/types/plan'
import { toLocalDate } from '@/core/types/common'
import { ALL_PASSAGES, getPassageById, supportsPrediction, supportsVariableSpeed } from './index'

/**
 * 1セッションで出る設問の量を、実際の教材とプラン生成から数えて上限で止める。
 *
 * 設問はブロックごとに独立して決まるため、1ブロックずつ見ている限りは
 * どれも「3問だけ」に見える。効いてくるのは合計で、放っておくと
 * 30分のセッションで選択式が 20 問を超える（読む時間より答える時間が長くなる）。
 * ここが唯一その合計を見ている場所なので、上限は数字で固定しておく。
 */

/** 1ブロックで実際に出る選択式の設問数。UI と同じ選び方で数える。 */
function questionCount(block: PlanBlock): number {
  const passage = block.passageId ? getPassageById(block.passageId) : null

  switch (block.type) {
    case 'speed_push':
    case 'chunk_reading':
    case 'regression_control':
      return passage ? readCheckQuestions(passage.questions, block.minutes).length : 0
    case 'comprehension':
      return passage ? comprehensionQuestions(passage.questions).length : 0
    case 'structure_reading':
      return passage ? structureProbeIndexes(passage.paragraphs.length, block.minutes).length : 0
    case 'meaning_flash':
      return MEANING_FLASH.itemsPerSession
    case 'prediction_reading':
      return passage ? passage.paragraphs.filter((p) => p.predictionStop).length : 0
    // Variable Speed は読みながら速度帯を選ぶ。Recall は記述と自己評価で、設問ではない。
    case 'variable_speed':
    case 'warmup':
    case 'immediate_recall':
    case 'delayed_recall':
      return 0
    default:
      return 0
  }
}

const CANDIDATES: PassageCandidate[] = ALL_PASSAGES.map((passage: TrainingPassage) => ({
  id: passage.id,
  difficulty: passage.difficulty,
  characterCount: passage.characterCount,
  supportsPrediction: supportsPrediction(passage),
  supportsVariableSpeed: supportsVariableSpeed(passage),
}))

const PROFILE = computeSkillProfile({ results: [], recallTasks: [], baselineCpm: 500 })

function planFor(totalMinutes: PlanDuration, date: string) {
  const input: GenerateDailyPlanInput = {
    date: toLocalDate(date),
    totalMinutes,
    profile: PROFILE,
    passages: CANDIDATES,
    recentPassageIds: [],
    dueRecallCount: 1,
    targetCpm: 500,
    chunkLevel: 2,
    meaningFlashLevel: 2,
    preferredDifficulty: 3,
    userId: 'u',
    createdAt: `${date}T09:00:00.000Z`,
    planId: `plan-${date}-${totalMinutes}`,
  }
  return generateDailyPlan(input)
}

/** 2週間ぶん。任意ブロックの選択が日付で回るため、1日だけでは最悪ケースを踏まない。 */
const DATES = Array.from({ length: 14 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)

/**
 * 1セッションで許容する選択式の上限。
 *
 * 見直し前は 10 分 / 20 分がどちらも 16、30 分が 24 だった
 * （設問数がブロック時間と無関係だったため、短いセッションほど密度が高かった）。
 * Meaning Flash だけは 5 件固定で、これが上限を押し上げている
 * （フラッシュの正誤そのものが訓練であり、読後の確認設問ではない）。
 */
const MAX_QUESTIONS: Record<PlanDuration, number> = { 10: 13, 20: 16, 30: 20 }

/** 設問を出すブロックの数（「また設問か」と感じる回数）の上限。 */
const MAX_QUESTION_ROUNDS = 5

describe('1セッションの設問量', () => {
  const cases = ([10, 20, 30] as PlanDuration[]).flatMap((minutes) =>
    DATES.map((date) => ({ minutes, date })),
  )

  it.each(cases)('$minutes 分 / $date は選択式が上限を超えない', ({ minutes, date }) => {
    const total = planFor(minutes, date).blocks.reduce((sum, b) => sum + questionCount(b), 0)
    expect(total).toBeLessThanOrEqual(MAX_QUESTIONS[minutes])
  })

  it('短いセッションほど設問が少ない', () => {
    // 設問数を時間と切り離すと、10分でも20分と同じ数の設問が出る。
    const worst = (minutes: PlanDuration) =>
      Math.max(
        ...DATES.map((date) =>
          planFor(minutes, date).blocks.reduce((sum, b) => sum + questionCount(b), 0),
        ),
      )
    expect(worst(10)).toBeLessThan(worst(20))
    expect(worst(20)).toBeLessThanOrEqual(worst(30))
  })

  it.each(cases)('$minutes 分 / $date は設問ラウンドが上限を超えない', ({ minutes, date }) => {
    const rounds = planFor(minutes, date).blocks.filter((b) => questionCount(b) > 0).length
    expect(rounds).toBeLessThanOrEqual(MAX_QUESTION_ROUNDS)
  })

  it('速度調整に足りるだけの設問はセッション内に残っている', () => {
    // ここを割ると adaptSpeed が毎回 hold になり、目標速度が一生動かない。
    for (const { minutes, date } of cases) {
      const total = planFor(minutes, date).blocks.reduce((sum, b) => sum + questionCount(b), 0)
      expect(total).toBeGreaterThanOrEqual(QUESTIONS.comprehension)
    }
  })

  it('理解度を測るブロックは毎回入っている', () => {
    for (const { minutes, date } of cases) {
      const plan = planFor(minutes, date)
      const comprehension = plan.blocks.find((b) => b.type === 'comprehension')
      expect(comprehension).toBeDefined()
      expect(questionCount(comprehension!)).toBe(QUESTIONS.comprehension)
    }
  })

  it('Structure Reading は本文を全段落読ませる（設問だけ間引く）', () => {
    for (const { minutes, date } of cases) {
      const block = planFor(minutes, date).blocks.find((b) => b.type === 'structure_reading')
      expect(block).toBeDefined()
      const passage = getPassageById(block!.passageId ?? '')
      expect(passage).not.toBeNull()
      // 段落数は減らさない。減るのは設問の数だけ。
      expect(passage!.paragraphs.length).toBeGreaterThanOrEqual(questionCount(block!))
      expect(questionCount(block!)).toBeLessThanOrEqual(QUESTIONS.structureProbes)
    }
  })
})
