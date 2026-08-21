import { describe, expect, it } from 'vitest'
import { PLAN } from '../config/training-config'
import { toLocalDate, type PlanDuration } from '../types/common'
import type { SkillId, SkillProfile, SkillState } from '../types/skill'
import { SKILL_IDS } from '../types/skill'
import type { TrainingType } from '../types/training'
import { generateDailyPlan, type GenerateDailyPlanInput, type PassageCandidate } from './daily-plan'

function profileOf(
  overrides: Partial<Record<SkillId, { score: number; state: SkillState }>> = {},
): SkillProfile {
  return Object.fromEntries(
    SKILL_IDS.map((id) => {
      const override = overrides[id]
      return [
        id,
        {
          id,
          score: override?.score ?? null,
          state: override?.state ?? 'unmeasured',
          sampleCount: override ? 3 : 0,
          trend: null,
        },
      ]
    }),
  ) as SkillProfile
}

const weak = (score = 30) => ({ score, state: 'weak' as const })
const normal = (score = 65) => ({ score, state: 'normal' as const })
const strong = (score = 90) => ({ score, state: 'strong' as const })

const PASSAGES: PassageCandidate[] = Array.from({ length: 14 }, (_, i) => ({
  id: `p-${String(i + 1).padStart(2, '0')}`,
  difficulty: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
  characterCount: 900 + i * 20,
  supportsPrediction: i % 2 === 0,
  supportsVariableSpeed: i % 3 === 0,
}))

const input = (overrides: Partial<GenerateDailyPlanInput> = {}): GenerateDailyPlanInput => ({
  date: toLocalDate('2026-08-19'),
  totalMinutes: 30,
  profile: profileOf(),
  passages: PASSAGES,
  recentPassageIds: [],
  dueRecallCount: 0,
  targetCpm: 690,
  chunkLevel: 2,
  meaningFlashLevel: 2,
  preferredDifficulty: 3,
  userId: 'u',
  createdAt: '2026-08-19T09:00:00Z',
  planId: 'plan-1',
  ...overrides,
})

const trainingMinutes = (plan: { blocks: { type: string; minutes: number }[] }) =>
  plan.blocks
    .filter((b) => b.type !== 'delayed_recall')
    .reduce((sum, b) => sum + b.minutes, 0)

const minutesOf = (
  plan: { blocks: { type: string; minutes: number }[] },
  type: string,
): number => plan.blocks.find((b) => b.type === type)?.minutes ?? 0

describe('generateDailyPlan: 時間配分', () => {
  it.each([10, 20, 30] as PlanDuration[])('合計が %i 分ちょうどになる', (minutes) => {
    expect(trainingMinutes(generateDailyPlan(input({ totalMinutes: minutes })))).toBe(minutes)
  })

  it.each([10, 20, 30] as PlanDuration[])(
    '%i 分でも弱点がある場合に合計が変わらない',
    (minutes) => {
      const plan = generateDailyPlan(
        input({
          totalMinutes: minutes,
          profile: profileOf({
            meaning_extraction: weak(),
            structure_recognition: weak(),
            immediate_recall: weak(),
          }),
        }),
      )
      expect(trainingMinutes(plan)).toBe(minutes)
    },
  )

  it('30 分を超えない', () => {
    const plan = generateDailyPlan(input({ dueRecallCount: 3 }))
    const total = plan.blocks.reduce((sum, b) => sum + b.minutes, 0)
    expect(total).toBeLessThanOrEqual(30 + PLAN.delayedRecallMinutes)
  })

  it('各ブロックが最小分数を下回らない', () => {
    const plan = generateDailyPlan(
      input({
        profile: profileOf({
          structure_recognition: weak(),
          comprehension: weak(),
          immediate_recall: weak(),
        }),
      }),
    )
    for (const block of plan.blocks) {
      expect(block.minutes).toBeGreaterThanOrEqual(PLAN.coreBlockMinMinutes)
    }
  })

  it('コアのトレーニングは必ず含まれる', () => {
    const types = generateDailyPlan(input()).blocks.map((b) => b.type)
    const coreTypes: TrainingType[] = [
      'warmup',
      'speed_push',
      'structure_reading',
      'comprehension',
      'immediate_recall',
    ]
    for (const core of coreTypes) {
      expect(types).toContain(core)
    }
  })

  it('order が 1 から連番になる', () => {
    const plan = generateDailyPlan(input({ dueRecallCount: 1 }))
    expect(plan.blocks.map((b) => b.order)).toEqual(
      Array.from({ length: plan.blocks.length }, (_, i) => i + 1),
    )
  })

  it('認知処理の順に並ぶ（意味 → チャンク → 予測 → 構造 → 速度切替）', () => {
    const plan = generateDailyPlan(input({ totalMinutes: 30 }))
    const order = plan.blocks.map((b) => b.type)
    const indexOf = (type: TrainingType) => order.indexOf(type)
    expect(indexOf('warmup')).toBeLessThan(indexOf('speed_push'))
    expect(indexOf('speed_push')).toBeLessThan(indexOf('structure_reading'))
    expect(indexOf('structure_reading')).toBeLessThan(indexOf('comprehension'))
    expect(indexOf('comprehension')).toBeLessThan(indexOf('immediate_recall'))
  })
})

describe('generateDailyPlan: 任意ブロックの数', () => {
  const OPTIONAL: TrainingType[] = [
    'meaning_flash',
    'chunk_reading',
    'prediction_reading',
    'variable_speed',
    'regression_control',
  ]

  const optionalBlocks = (minutes: PlanDuration, date = '2026-08-19') =>
    generateDailyPlan(input({ totalMinutes: minutes, date: toLocalDate(date) })).blocks.filter((b) =>
      OPTIONAL.includes(b.type),
    )

  it.each([10, 20, 30] as PlanDuration[])('%i 分では上限数を超えない', (minutes) => {
    expect(optionalBlocks(minutes).length).toBeLessThanOrEqual(PLAN.optionalBlockCount[minutes])
  })

  it.each([10, 20, 30] as PlanDuration[])('%i 分でも任意ブロックが消えない', (minutes) => {
    expect(optionalBlocks(minutes).length).toBeGreaterThan(0)
  })

  it('ブロック数を絞っても任意ブロックの合計時間は予算どおり', () => {
    for (const minutes of [10, 20, 30] as PlanDuration[]) {
      const total = optionalBlocks(minutes).reduce((sum, b) => sum + b.minutes, 0)
      expect(total).toBe(PLAN.optionalBudget[minutes])
    }
  })

  it('1日のブロック数が増えすぎない（設問ラウンドの上限）', () => {
    // ブロックを刻むほど intro と設問が増え、訓練そのものの時間が痩せる。
    for (const minutes of [10, 20, 30] as PlanDuration[]) {
      const plan = generateDailyPlan(input({ totalMinutes: minutes }))
      expect(plan.blocks.length).toBeLessThanOrEqual(8)
    }
  })

  it('日を跨げば任意ブロックは一巡する', () => {
    const seen = new Set<TrainingType>()
    for (let day = 1; day <= 14; day += 1) {
      const date = `2026-09-${String(day).padStart(2, '0')}`
      for (const block of optionalBlocks(30, date)) seen.add(block.type)
    }
    expect([...seen].sort()).toEqual([...OPTIONAL].sort())
  })
})

describe('generateDailyPlan: 決定性', () => {
  it('同じ入力からは常に同じ構成になる', () => {
    expect(generateDailyPlan(input())).toEqual(generateDailyPlan(input()))
  })

  it('日付が変わると任意ブロックの選択が回る', () => {
    const dates = ['2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22']
    const sets = dates.map((date) =>
      generateDailyPlan(input({ date: toLocalDate(date) }))
        .blocks.map((b) => b.type)
        .join(','),
    )
    expect(new Set(sets).size).toBeGreaterThan(1)
  })
})

describe('generateDailyPlan: 弱点に応じた選択', () => {
  it('意味抽出が弱ければ Meaning Flash を入れる', () => {
    const plan = generateDailyPlan(
      input({ profile: profileOf({ meaning_extraction: weak() }) }),
    )
    expect(plan.blocks.map((b) => b.type)).toContain('meaning_flash')
  })

  it('予測が弱ければ Prediction Reading を入れる', () => {
    const plan = generateDailyPlan(input({ profile: profileOf({ prediction: weak() }) }))
    expect(plan.blocks.map((b) => b.type)).toContain('prediction_reading')
  })

  it('速度切替が弱ければ Variable Speed を入れる', () => {
    const plan = generateDailyPlan(input({ profile: profileOf({ adaptive_reading: weak() }) }))
    expect(plan.blocks.map((b) => b.type)).toContain('variable_speed')
  })

  it('チャンク認識が弱ければ Chunk Reading を入れる', () => {
    const plan = generateDailyPlan(input({ profile: profileOf({ chunk_recognition: weak() }) }))
    expect(plan.blocks.map((b) => b.type)).toContain('chunk_reading')
  })

  it('構造把握が弱ければ Structure Reading の時間を増やす', () => {
    const base = generateDailyPlan(input({ profile: profileOf({ structure_recognition: normal() }) }))
    const weakPlan = generateDailyPlan(
      input({ profile: profileOf({ structure_recognition: weak() }) }),
    )
    expect(minutesOf(weakPlan, 'structure_reading')).toBeGreaterThan(
      minutesOf(base, 'structure_reading'),
    )
  })

  it('速度が高く理解が低いとき Speed Push を増やさない', () => {
    const base = generateDailyPlan(input({ profile: profileOf({}) }))
    const plan = generateDailyPlan(
      input({ profile: profileOf({ reading_speed: strong(), comprehension: weak() }) }),
    )
    expect(minutesOf(plan, 'speed_push')).toBeLessThanOrEqual(minutesOf(base, 'speed_push'))
    expect(minutesOf(plan, 'structure_reading')).toBeGreaterThan(minutesOf(base, 'structure_reading'))
  })

  it('速度が弱く理解が保てていれば Speed Push を増やす', () => {
    const base = generateDailyPlan(input({ profile: profileOf({}) }))
    const plan = generateDailyPlan(
      input({ profile: profileOf({ reading_speed: weak(), comprehension: strong() }) }),
    )
    expect(minutesOf(plan, 'speed_push')).toBeGreaterThan(minutesOf(base, 'speed_push'))
  })

  it('想起が弱いとき、速度ではなく Recall を増やす', () => {
    const base = generateDailyPlan(input({ profile: profileOf({}) }))
    const plan = generateDailyPlan(
      input({ profile: profileOf({ immediate_recall: weak(), reading_speed: weak() }) }),
    )
    expect(minutesOf(plan, 'immediate_recall')).toBeGreaterThan(minutesOf(base, 'immediate_recall'))
    expect(minutesOf(plan, 'speed_push')).toBeLessThanOrEqual(minutesOf(base, 'speed_push'))
  })

  it('弱点を判定理由に残す', () => {
    const plan = generateDailyPlan(
      input({ profile: profileOf({ structure_recognition: weak() }) }),
    )
    expect(plan.generatedReason?.weakestSkills).toContain('structure_recognition')
    expect(plan.generatedReason?.notes.join()).toContain('Structure Reading')
  })

  it('測定のために入れたスキルを記録する', () => {
    const plan = generateDailyPlan(input({ profile: profileOf() }))
    expect(plan.generatedReason?.measuredForFirstTime?.length).toBeGreaterThan(0)
  })
})

describe('generateDailyPlan: 教材の割り当て', () => {
  it('Speed Push / Chunk / Structure に別々の教材を割り当てる', () => {
    const plan = generateDailyPlan(
      input({ profile: profileOf({ chunk_recognition: weak() }) }),
    )
    const ids = ['speed_push', 'chunk_reading', 'structure_reading']
      .map((type) => plan.blocks.find((b) => b.type === type)?.passageId)
      .filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('Comprehension と Immediate Recall は Structure と同じ教材を使う', () => {
    const plan = generateDailyPlan(input())
    const structureId = plan.blocks.find((b) => b.type === 'structure_reading')?.passageId
    expect(plan.blocks.find((b) => b.type === 'comprehension')?.passageId).toBe(structureId)
    expect(plan.blocks.find((b) => b.type === 'immediate_recall')?.passageId).toBe(structureId)
  })

  it('Prediction には停止位置を持つ教材だけを割り当てる', () => {
    const plan = generateDailyPlan(input({ profile: profileOf({ prediction: weak() }) }))
    const id = plan.blocks.find((b) => b.type === 'prediction_reading')?.passageId
    expect(PASSAGES.find((p) => p.id === id)?.supportsPrediction).toBe(true)
  })

  it('Variable Speed には区間定義を持つ教材だけを割り当てる', () => {
    const plan = generateDailyPlan(input({ profile: profileOf({ adaptive_reading: weak() }) }))
    const id = plan.blocks.find((b) => b.type === 'variable_speed')?.passageId
    expect(PASSAGES.find((p) => p.id === id)?.supportsVariableSpeed).toBe(true)
  })

  it('対応教材がなければそのトレーニングを選ばない', () => {
    const plan = generateDailyPlan(
      input({
        profile: profileOf({ adaptive_reading: weak() }),
        passages: PASSAGES.map((p) => ({ ...p, supportsVariableSpeed: false })),
      }),
    )
    expect(plan.blocks.map((b) => b.type)).not.toContain('variable_speed')
    expect(trainingMinutes(plan)).toBe(30)
  })

  it('直近で使った教材を避ける', () => {
    const first = generateDailyPlan(input())
    const used = first.blocks.flatMap((b) => (b.passageId ? [b.passageId] : []))
    const next = generateDailyPlan(input({ recentPassageIds: used }))
    const nextUsed = next.blocks.flatMap((b) => (b.passageId ? [b.passageId] : []))
    expect(nextUsed.some((id) => used.includes(id))).toBe(false)
  })

  it('教材が少なくても落ちない', () => {
    const plan = generateDailyPlan(input({ passages: PASSAGES.slice(0, 1) }))
    expect(plan.blocks.length).toBeGreaterThan(0)
  })
})

describe('generateDailyPlan: 翌日 Recall', () => {
  it('実施待ちがあれば先頭に差し込む', () => {
    const plan = generateDailyPlan(input({ dueRecallCount: 1 }))
    expect(plan.blocks[0]?.type).toBe('delayed_recall')
  })

  it('差し込んでも本編の合計時間は変わらない', () => {
    expect(trainingMinutes(generateDailyPlan(input({ dueRecallCount: 2 })))).toBe(30)
  })
})

describe('generateDailyPlan: レベルと速度の受け渡し', () => {
  it('目標速度とレベルをブロックに渡す', () => {
    const plan = generateDailyPlan(
      input({
        targetCpm: 800,
        chunkLevel: 4,
        meaningFlashLevel: 3,
        profile: profileOf({ chunk_recognition: weak(), meaning_extraction: weak() }),
      }),
    )
    expect(plan.blocks.find((b) => b.type === 'speed_push')?.targetCpm).toBe(800)
    expect(plan.blocks.find((b) => b.type === 'chunk_reading')?.chunkLevel).toBe(4)
    expect(plan.blocks.find((b) => b.type === 'meaning_flash')?.chunkLevel).toBe(3)
  })
})
