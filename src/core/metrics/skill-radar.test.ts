import { describe, expect, it } from 'vitest'
import { SCORING } from '../config/training-config'
import { toLocalDate } from '../types/common'
import type { RecallTask, TrainingResult } from '../types/training'
import { computeSkillRadar, SKILL_AXES } from './skill-radar'

const result = (overrides: Partial<TrainingResult> = {}): TrainingResult => ({
  id: Math.random().toString(),
  userId: 'u',
  sessionId: 's',
  trainingType: 'speed_push',
  passageId: 'p',
  cpm: null,
  comprehensionScore: null,
  immediateRecallScore: null,
  delayedRecallScore: null,
  targetCpm: null,
  backCount: null,
  pauseCount: null,
  chunkLevel: null,
  difficulty: null,
  valid: true,
  createdAt: '2026-08-19T09:00:00Z',
  ...overrides,
})

const recallTask = (score: number): RecallTask => ({
  id: Math.random().toString(),
  userId: 'u',
  passageId: 'p',
  sourceSessionId: null,
  scheduledDate: toLocalDate('2026-08-19'),
  expiresOn: toLocalDate('2026-08-22'),
  completedAt: '2026-08-19T09:00:00Z',
  recallScore: score,
  recallText: null,
  status: 'completed',
  createdAt: '2026-08-19T09:00:00Z',
})

describe('computeSkillRadar', () => {
  it('実績がなければ全軸が中央値、measured はすべて false', () => {
    const { scores, measured } = computeSkillRadar({
      results: [],
      recallTasks: [],
      baselineCpm: 600,
    })
    for (const axis of SKILL_AXES) {
      expect(scores[axis]).toBe(SCORING.neutralScore)
      expect(measured[axis]).toBe(false)
    }
  })

  it('サンプルが1件だけなら実測とみなさない', () => {
    const { measured } = computeSkillRadar({
      results: [result({ cpm: 600 })],
      recallTasks: [],
      baselineCpm: 600,
    })
    expect(measured.reading_speed).toBe(false)
  })

  it('Baseline の2倍で速度が満点になる', () => {
    const { scores, measured } = computeSkillRadar({
      results: [result({ cpm: 1200 }), result({ cpm: 1200 })],
      recallTasks: [],
      baselineCpm: 600,
    })
    expect(scores.reading_speed).toBe(100)
    expect(measured.reading_speed).toBe(true)
  })

  it('速度は 100 を超えない', () => {
    const { scores } = computeSkillRadar({
      results: [result({ cpm: 9000 }), result({ cpm: 9000 })],
      recallTasks: [],
      baselineCpm: 600,
    })
    expect(scores.reading_speed).toBe(100)
  })

  it('Baseline が未測定なら速度軸は中央値のまま', () => {
    const { scores, measured } = computeSkillRadar({
      results: [result({ cpm: 1200 }), result({ cpm: 1200 })],
      recallTasks: [],
      baselineCpm: null,
    })
    expect(scores.reading_speed).toBe(SCORING.neutralScore)
    expect(measured.reading_speed).toBe(false)
  })

  it('Chunking はレベルを加味する（同じ正答率でも高レベルほど高い）', () => {
    const low = computeSkillRadar({
      results: [
        result({ trainingType: 'chunk_reading', comprehensionScore: 100, chunkLevel: 1 }),
        result({ trainingType: 'chunk_reading', comprehensionScore: 100, chunkLevel: 1 }),
      ],
      recallTasks: [],
      baselineCpm: 600,
    })
    const high = computeSkillRadar({
      results: [
        result({ trainingType: 'chunk_reading', comprehensionScore: 100, chunkLevel: 5 }),
        result({ trainingType: 'chunk_reading', comprehensionScore: 100, chunkLevel: 5 }),
      ],
      recallTasks: [],
      baselineCpm: 600,
    })
    expect(high.scores.chunking).toBeGreaterThan(low.scores.chunking)
    expect(high.scores.chunking).toBe(100)
  })

  it('Structure は段落要旨の正答率を使う', () => {
    const { scores, measured } = computeSkillRadar({
      results: [
        result({ trainingType: 'structure_reading', comprehensionScore: 80 }),
        result({ trainingType: 'structure_reading', comprehensionScore: 60 }),
      ],
      recallTasks: [],
      baselineCpm: 600,
    })
    expect(scores.structure).toBe(70)
    expect(measured.structure).toBe(true)
  })

  it('Recall は翌日想起を重く見る', () => {
    const { scores } = computeSkillRadar({
      results: [
        result({ trainingType: 'immediate_recall', immediateRecallScore: 100 }),
        result({ trainingType: 'immediate_recall', immediateRecallScore: 100 }),
      ],
      recallTasks: [recallTask(0), recallTask(0)],
      baselineCpm: 600,
    })
    expect(scores.recall).toBeLessThan(50)
  })

  it('無効な計測を含めない', () => {
    const { measured } = computeSkillRadar({
      results: [result({ cpm: 99999, valid: false }), result({ cpm: 99999, valid: false })],
      recallTasks: [],
      baselineCpm: 600,
    })
    expect(measured.reading_speed).toBe(false)
  })

  it('全軸が 0〜100 に収まる', () => {
    const { scores } = computeSkillRadar({
      results: [
        result({ cpm: 5000 }),
        result({ cpm: 5000 }),
        result({ trainingType: 'structure_reading', comprehensionScore: 100 }),
        result({ trainingType: 'structure_reading', comprehensionScore: 100 }),
      ],
      recallTasks: [recallTask(100), recallTask(100)],
      baselineCpm: 600,
    })
    for (const axis of SKILL_AXES) {
      expect(scores[axis]).toBeGreaterThanOrEqual(0)
      expect(scores[axis]).toBeLessThanOrEqual(100)
    }
  })
})
