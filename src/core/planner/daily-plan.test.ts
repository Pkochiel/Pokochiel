import { describe, expect, it } from 'vitest'
import { PLAN } from '../config/training-config'
import { toLocalDate } from '../types/common'
import type { PlanDuration } from '../types/common'
import type { SkillRadar } from '../types/plan'
import { generateDailyPlan, type GenerateDailyPlanInput } from './daily-plan'

const NEUTRAL_RADAR: SkillRadar = {
  reading_speed: 60,
  chunking: 60,
  structure: 60,
  comprehension: 75,
  recall: 60,
  adaptive_reading: 60,
}

const PASSAGES = Array.from({ length: 12 }, (_, i) => ({
  id: `p-${String(i + 1).padStart(2, '0')}`,
  difficulty: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
  characterCount: 400 + i * 10,
}))

const input = (overrides: Partial<GenerateDailyPlanInput> = {}): GenerateDailyPlanInput => ({
  date: toLocalDate('2026-08-19'),
  totalMinutes: 30,
  radar: NEUTRAL_RADAR,
  passages: PASSAGES,
  recentPassageIds: [],
  dueRecallCount: 0,
  targetCpm: 690,
  chunkLevel: 2,
  preferredDifficulty: 3,
  userId: 'u',
  createdAt: '2026-08-19T09:00:00Z',
  planId: 'plan-1',
  ...overrides,
})

const totalMinutes = (plan: { blocks: { type: string; minutes: number }[] }) =>
  plan.blocks
    .filter((b) => b.type !== 'delayed_recall')
    .reduce((sum, b) => sum + b.minutes, 0)

describe('generateDailyPlan', () => {
  it.each([10, 20, 30] as PlanDuration[])('合計時間が %i 分ちょうどになる', (minutes) => {
    const plan = generateDailyPlan(input({ totalMinutes: minutes }))
    expect(totalMinutes(plan)).toBe(minutes)
  })

  it('仕様どおりの構成を含む', () => {
    const plan = generateDailyPlan(input())
    expect(plan.blocks.map((b) => b.type)).toEqual([
      'warmup',
      'speed_push',
      'chunk_reading',
      'structure_reading',
      'comprehension',
      'immediate_recall',
    ])
  })

  it('同じ入力からは常に同じ構成になる（決定的）', () => {
    expect(generateDailyPlan(input())).toEqual(generateDailyPlan(input()))
  })

  it('order が 1 から連番になる', () => {
    const plan = generateDailyPlan(input())
    expect(plan.blocks.map((b) => b.order)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('各ブロックが最小分数を下回らない', () => {
    const plan = generateDailyPlan(input({ radar: { ...NEUTRAL_RADAR, recall: 10, chunking: 10 } }))
    for (const block of plan.blocks) {
      expect(block.minutes).toBeGreaterThanOrEqual(PLAN.blockMinMinutes)
    }
  })

  describe('翌日 Recall', () => {
    it('実施待ちがあれば先頭に差し込む', () => {
      const plan = generateDailyPlan(input({ dueRecallCount: 1 }))
      expect(plan.blocks[0]?.type).toBe('delayed_recall')
      expect(plan.blocks[0]?.order).toBe(1)
    })

    it('差し込んでも本編の合計時間は変わらない', () => {
      expect(totalMinutes(generateDailyPlan(input({ dueRecallCount: 2 })))).toBe(30)
    })

    it('実施待ちがなければ差し込まない', () => {
      const plan = generateDailyPlan(input())
      expect(plan.blocks.some((b) => b.type === 'delayed_recall')).toBe(false)
    })
  })

  describe('弱点に応じた配分', () => {
    it('Recall が低いとき、速度ではなく Recall と Structure の配分を増やす', () => {
      const weak = generateDailyPlan(input({ radar: { ...NEUTRAL_RADAR, recall: 20 } }))
      const neutral = generateDailyPlan(input())

      const minutesOf = (plan: typeof weak, type: string) =>
        plan.blocks.find((b) => b.type === type)?.minutes ?? 0

      expect(minutesOf(weak, 'immediate_recall')).toBeGreaterThan(
        minutesOf(neutral, 'immediate_recall'),
      )
      expect(minutesOf(weak, 'structure_reading')).toBeGreaterThanOrEqual(
        minutesOf(neutral, 'structure_reading'),
      )
      // 速度そのものは下げない
      expect(weak.targetCpm).toBe(neutral.targetCpm)
      expect(minutesOf(weak, 'speed_push')).toBeLessThanOrEqual(minutesOf(neutral, 'speed_push'))
    })

    it('Chunking が弱いとき Chunk Reading を増やす', () => {
      const weak = generateDailyPlan(input({ radar: { ...NEUTRAL_RADAR, chunking: 20 } }))
      const neutral = generateDailyPlan(input())
      const minutesOf = (plan: typeof weak, type: string) =>
        plan.blocks.find((b) => b.type === type)?.minutes ?? 0
      expect(minutesOf(weak, 'chunk_reading')).toBeGreaterThan(minutesOf(neutral, 'chunk_reading'))
    })

    it('弱点の判定理由を残す', () => {
      const plan = generateDailyPlan(input({ radar: { ...NEUTRAL_RADAR, recall: 20 } }))
      expect(plan.generatedReason?.notes.join()).toContain('想起')
      expect(plan.generatedReason?.weakestSkills[0]).toBe('recall')
    })
  })

  describe('教材の割り当て', () => {
    it('Speed Push / Chunk / Structure に別々の教材を割り当てる', () => {
      const plan = generateDailyPlan(input())
      const ids = ['speed_push', 'chunk_reading', 'structure_reading'].map(
        (type) => plan.blocks.find((b) => b.type === type)?.passageId,
      )
      expect(new Set(ids).size).toBe(3)
      expect(ids.every(Boolean)).toBe(true)
    })

    it('Comprehension と Immediate Recall は Structure と同じ教材を使う', () => {
      const plan = generateDailyPlan(input())
      const structureId = plan.blocks.find((b) => b.type === 'structure_reading')?.passageId
      expect(plan.blocks.find((b) => b.type === 'comprehension')?.passageId).toBe(structureId)
      expect(plan.blocks.find((b) => b.type === 'immediate_recall')?.passageId).toBe(structureId)
    })

    it('直近で使った教材を避ける', () => {
      const plan = generateDailyPlan(input())
      const used = plan.blocks.flatMap((b) => (b.passageId ? [b.passageId] : []))
      const next = generateDailyPlan(input({ recentPassageIds: used }))
      const nextUsed = next.blocks.flatMap((b) => (b.passageId ? [b.passageId] : []))
      expect(nextUsed.some((id) => used.includes(id))).toBe(false)
    })

    it('目標難易度に近い教材を優先する', () => {
      const plan = generateDailyPlan(input({ preferredDifficulty: 5 }))
      const speedPushId = plan.blocks.find((b) => b.type === 'speed_push')?.passageId
      const difficulty = PASSAGES.find((p) => p.id === speedPushId)?.difficulty
      expect(difficulty).toBe(5)
    })

    it('教材が足りなくても落ちない', () => {
      const plan = generateDailyPlan(input({ passages: PASSAGES.slice(0, 1) }))
      expect(plan.blocks.length).toBeGreaterThan(0)
    })
  })

  it('目標速度とチャンクレベルをブロックに渡す', () => {
    const plan = generateDailyPlan(input({ targetCpm: 800, chunkLevel: 4 }))
    expect(plan.blocks.find((b) => b.type === 'speed_push')?.targetCpm).toBe(800)
    expect(plan.blocks.find((b) => b.type === 'chunk_reading')?.chunkLevel).toBe(4)
  })
})

describe('新規ユーザー（実測がまだない場合）', () => {
  const NEUTRAL_UNMEASURED = {
    reading_speed: false,
    chunking: false,
    structure: false,
    comprehension: false,
    recall: false,
    adaptive_reading: false,
  }

  const ALL_NEUTRAL: SkillRadar = {
    reading_speed: 50,
    chunking: 50,
    structure: 50,
    comprehension: 50,
    recall: 50,
    adaptive_reading: 50,
  }

  it('未実測の軸を弱点として扱わず、基本構成をそのまま使う', () => {
    const plan = generateDailyPlan(
      input({ radar: ALL_NEUTRAL, measuredAxes: NEUTRAL_UNMEASURED }),
    )
    expect(plan.blocks.map((b) => [b.type, b.minutes])).toEqual([
      ['warmup', 3],
      ['speed_push', 5],
      ['chunk_reading', 5],
      ['structure_reading', 7],
      ['comprehension', 5],
      ['immediate_recall', 5],
    ])
  })

  it('実測がなければ、その旨を理由に残す', () => {
    const plan = generateDailyPlan(
      input({ radar: ALL_NEUTRAL, measuredAxes: NEUTRAL_UNMEASURED }),
    )
    expect(plan.generatedReason?.notes.join()).toContain('実績がまだない')
  })

  it('実測済みの軸だけで判断する', () => {
    const plan = generateDailyPlan(
      input({
        radar: { ...ALL_NEUTRAL, chunking: 20, comprehension: 20 },
        measuredAxes: { ...NEUTRAL_UNMEASURED, chunking: true },
      }),
    )
    const minutesOf = (type: string) => plan.blocks.find((b) => b.type === type)?.minutes ?? 0
    // chunking のみ実測 → 増えるのは Chunk Reading だけ
    expect(minutesOf('chunk_reading')).toBeGreaterThan(5)
    expect(minutesOf('comprehension')).toBeLessThanOrEqual(5)
    expect(minutesOf('structure_reading')).toBeLessThanOrEqual(7)
  })
})

describe('配分の移動', () => {
  it('供出元もベース配分の半分は残す（構成が崩れない）', () => {
    const plan = generateDailyPlan(
      input({ radar: { ...NEUTRAL_RADAR, comprehension: 20, recall: 20, chunking: 20 } }),
    )
    for (const block of plan.blocks) {
      expect(block.minutes).toBeGreaterThanOrEqual(2)
    }
  })

  it('移動量は総時間の 20% を超えない', () => {
    const neutral = generateDailyPlan(input())
    const weak = generateDailyPlan(input({ radar: { ...NEUTRAL_RADAR, recall: 10 } }))
    const moved = weak.blocks.reduce((sum, block) => {
      const before = neutral.blocks.find((b) => b.type === block.type)?.minutes ?? 0
      return sum + Math.max(0, block.minutes - before)
    }, 0)
    expect(moved).toBeLessThanOrEqual(Math.floor(30 * PLAN.reallocationRatio))
  })
})
