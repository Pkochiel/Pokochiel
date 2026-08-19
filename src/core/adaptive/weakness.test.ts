import { describe, expect, it } from 'vitest'
import { RECALL, SCORING } from '../config/training-config'
import type { SkillRadar } from '../types/plan'
import { assessWeakness } from './weakness'

const strong: SkillRadar = {
  reading_speed: 80,
  chunking: 80,
  structure: 85,
  comprehension: 90,
  recall: 80,
  adaptive_reading: 80,
}

const allMeasured = {
  reading_speed: true,
  chunking: true,
  structure: true,
  comprehension: true,
  recall: true,
  adaptive_reading: true,
}

describe('assessWeakness', () => {
  it('Recall が低いとき、Recall と Structure を増やす', () => {
    const result = assessWeakness(
      { ...strong, recall: RECALL.lowRecallThreshold - 1 },
      allMeasured,
    )
    expect(result.emphasize).toContain('immediate_recall')
    expect(result.emphasize).toContain('structure_reading')
    // 速度を下げる指示は出さない
    expect(result.emphasize).not.toContain('speed_push')
    expect(result.notes.join()).toContain('速度を下げるのではなく')
  })

  it('Chunking が弱いとき、Chunk Reading を増やす', () => {
    const result = assessWeakness({ ...strong, chunking: 30 }, allMeasured)
    expect(result.emphasize).toContain('chunk_reading')
  })

  it('理解度が目標を下回るとき、構造把握と理解度テストを増やす', () => {
    const result = assessWeakness(
      { ...strong, comprehension: SCORING.comprehensionPassThreshold - 1 },
      allMeasured,
    )
    expect(result.emphasize).toEqual(
      expect.arrayContaining(['structure_reading', 'comprehension']),
    )
  })

  it('弱い順に軸を並べる', () => {
    const result = assessWeakness(
      { ...strong, chunking: 20, recall: 30, structure: 40 },
      allMeasured,
    )
    expect(result.ranked.slice(0, 3)).toEqual(['chunking', 'recall', 'structure'])
  })

  it('全体が高い場合でも、最も弱い軸を1つ強化する', () => {
    const result = assessWeakness({ ...strong, reading_speed: 70 }, allMeasured)
    expect(result.emphasize.length).toBeGreaterThan(0)
  })

  it('未実測の軸は弱点と判定しない', () => {
    const result = assessWeakness(
      { ...strong, recall: 10, chunking: 10 },
      { ...allMeasured, recall: false, chunking: false },
    )
    expect(result.emphasize).not.toContain('immediate_recall')
    expect(result.emphasize).not.toContain('chunk_reading')
  })

  it('実測が1つもなければ何も強調しない', () => {
    const result = assessWeakness(strong, {
      reading_speed: false,
      chunking: false,
      structure: false,
      comprehension: false,
      recall: false,
      adaptive_reading: false,
    })
    expect(result.emphasize).toEqual([])
    expect(result.ranked).toEqual([])
    expect(result.notes.join()).toContain('実績がまだない')
  })

  it('同じ入力からは常に同じ結果になる', () => {
    const radar = { ...strong, chunking: 40, recall: 40 }
    expect(assessWeakness(radar, allMeasured)).toEqual(assessWeakness(radar, allMeasured))
  })

  it('重複した強調対象をまとめる', () => {
    const result = assessWeakness({ ...strong, recall: 20, comprehension: 30 }, allMeasured)
    expect(new Set(result.emphasize).size).toBe(result.emphasize.length)
  })
})
