import { describe, expect, it } from 'vitest'
import { SKILL } from '../config/training-config'
import { SKILL_IDS } from '../types/skill'
import { makeRecallTask, makeResult, makeSeries } from '../__tests__/fixtures'
import { computeSkillProfile, measuredSkills, rankSkillsByNeed } from './skill-profile'

const empty = { results: [], recallTasks: [], baselineCpm: 600 }

describe('computeSkillProfile: 未測定の扱い', () => {
  it('実績がなければ全スキルが unmeasured で score は null', () => {
    const profile = computeSkillProfile(empty)
    for (const id of SKILL_IDS) {
      expect(profile[id].state).toBe('unmeasured')
      expect(profile[id].score).toBeNull()
      expect(profile[id].sampleCount).toBe(0)
    }
  })

  it('未測定を 0 点として扱わない', () => {
    const profile = computeSkillProfile(empty)
    expect(profile.meaning_extraction.score).not.toBe(0)
  })

  it('サンプルが1件だけなら未測定のままにする', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: [makeResult({ trainingType: 'structure_reading', comprehensionScore: 90 })],
    })
    expect(profile.structure_recognition.state).toBe('unmeasured')
    expect(profile.structure_recognition.sampleCount).toBe(1)
  })

  it('未測定の間はスコアを出さない（測定済みに見せない）', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: [makeResult({ trainingType: 'structure_reading', comprehensionScore: 90 })],
    })
    expect(profile.structure_recognition.score).toBeNull()
  })
})

describe('computeSkillProfile: 状態の分類', () => {
  const structureWith = (score: number) =>
    computeSkillProfile({
      ...empty,
      results: makeSeries(3, () => ({
        trainingType: 'structure_reading',
        comprehensionScore: score,
      })),
    }).structure_recognition

  it('閾値未満は weak', () => {
    expect(structureWith(SKILL.weakBelow - 1).state).toBe('weak')
  })

  it('閾値以上・強い基準未満は normal', () => {
    expect(structureWith(SKILL.weakBelow).state).toBe('normal')
    expect(structureWith(SKILL.strongAtOrAbove - 1).state).toBe('normal')
  })

  it('強い基準以上は strong', () => {
    expect(structureWith(SKILL.strongAtOrAbove).state).toBe('strong')
    expect(structureWith(100).state).toBe('strong')
  })

  it('weak / unmeasured / normal / strong を混同しない', () => {
    const states = new Set([
      structureWith(30).state,
      structureWith(60).state,
      structureWith(90).state,
      computeSkillProfile(empty).structure_recognition.state,
    ])
    expect(states).toEqual(new Set(['weak', 'normal', 'strong', 'unmeasured']))
  })
})

describe('computeSkillProfile: 各スキルの測定源', () => {
  it('Reading Speed は Baseline に対する相対速度で決まる', () => {
    const profile = computeSkillProfile({
      ...empty,
      baselineCpm: 600,
      results: makeSeries(3, () => ({ trainingType: 'speed_push', cpm: 1200 })),
    })
    // baseline の 2 倍で満点
    expect(profile.reading_speed.score).toBe(100)
  })

  it('Baseline が未測定なら Reading Speed は測定できない', () => {
    const profile = computeSkillProfile({
      ...empty,
      baselineCpm: null,
      results: makeSeries(3, () => ({ trainingType: 'speed_push', cpm: 1200 })),
    })
    expect(profile.reading_speed.state).toBe('unmeasured')
  })

  it('Meaning Extraction は Meaning Flash の accuracyScore を使う', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: makeSeries(3, () => ({
        trainingType: 'meaning_flash',
        accuracyScore: 100,
        level: 5,
      })),
    })
    expect(profile.meaning_extraction.score).toBe(100)
  })

  it('同じ正答率でも、低いレベルでは満点にならない', () => {
    const at = (level: 1 | 5) =>
      computeSkillProfile({
        ...empty,
        results: makeSeries(3, () => ({
          trainingType: 'meaning_flash',
          accuracyScore: 100,
          level,
        })),
      }).meaning_extraction.score ?? 0
    expect(at(1)).toBeLessThan(at(5))
    expect(at(1)).toBeGreaterThan(0)
  })

  it('Prediction は prediction_reading の accuracyScore を使う', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: makeSeries(3, () => ({ trainingType: 'prediction_reading', accuracyScore: 70 })),
    })
    expect(profile.prediction.score).toBe(70)
    expect(profile.adaptive_reading.state).toBe('unmeasured')
  })

  it('Adaptive Reading は variable_speed の一致率を使う', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: makeSeries(3, () => ({ trainingType: 'variable_speed', accuracyScore: 40 })),
    })
    expect(profile.adaptive_reading.score).toBe(40)
    expect(profile.adaptive_reading.state).toBe('weak')
  })

  it('Delayed Recall は完了した Recall タスクのみを見る', () => {
    const profile = computeSkillProfile({
      ...empty,
      recallTasks: [
        makeRecallTask({ status: 'completed', recallScore: 50, createdAt: '2026-08-17T09:00:00Z' }),
        makeRecallTask({ status: 'completed', recallScore: 70, createdAt: '2026-08-18T09:00:00Z' }),
        makeRecallTask({ status: 'pending', createdAt: '2026-08-19T09:00:00Z' }),
        makeRecallTask({ status: 'expired', createdAt: '2026-08-16T09:00:00Z' }),
      ],
    })
    expect(profile.delayed_recall.score).toBe(60)
    expect(profile.delayed_recall.sampleCount).toBe(2)
  })

  it('無効な計測を含めない', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: makeSeries(3, () => ({
        trainingType: 'structure_reading',
        comprehensionScore: 10,
        valid: false,
      })),
    })
    expect(profile.structure_recognition.state).toBe('unmeasured')
  })

  it('スキルごとに独立して測定される', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: makeSeries(3, () => ({ trainingType: 'structure_reading', comprehensionScore: 90 })),
    })
    expect(profile.structure_recognition.state).toBe('strong')
    expect(profile.chunk_recognition.state).toBe('unmeasured')
    expect(profile.prediction.state).toBe('unmeasured')
  })
})

describe('computeSkillProfile: 傾向', () => {
  it('伸びていれば正の値になる', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: makeSeries(4, (i) => ({
        trainingType: 'structure_reading',
        comprehensionScore: 50 + i * 10,
      })),
    })
    expect(profile.structure_recognition.trend).toBeGreaterThan(0)
  })

  it('落ちていれば負の値になる', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: makeSeries(4, (i) => ({
        trainingType: 'structure_reading',
        comprehensionScore: 90 - i * 10,
      })),
    })
    expect(profile.structure_recognition.trend).toBeLessThan(0)
  })

  it('サンプルが足りなければ傾向を出さない', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: makeSeries(2, () => ({ trainingType: 'structure_reading', comprehensionScore: 70 })),
    })
    expect(profile.structure_recognition.trend).toBeNull()
  })
})

describe('rankSkillsByNeed', () => {
  it('weak を最優先し、その次に unmeasured を置く', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: [
        ...makeSeries(3, () => ({ trainingType: 'structure_reading', comprehensionScore: 20 })),
        ...makeSeries(3, () => ({ trainingType: 'comprehension', comprehensionScore: 95 })),
      ],
    })
    const ranked = rankSkillsByNeed(profile)
    expect(ranked[0]?.id).toBe('structure_recognition')
    expect(ranked[0]?.state).toBe('weak')
    expect(ranked[ranked.length - 1]?.state).toBe('strong')
    const unmeasuredIndex = ranked.findIndex((m) => m.state === 'unmeasured')
    const strongIndex = ranked.findIndex((m) => m.state === 'strong')
    expect(unmeasuredIndex).toBeLessThan(strongIndex)
  })

  it('同じ入力からは常に同じ並びになる', () => {
    const profile = computeSkillProfile(empty)
    expect(rankSkillsByNeed(profile).map((m) => m.id)).toEqual(
      rankSkillsByNeed(profile).map((m) => m.id),
    )
  })
})

describe('measuredSkills', () => {
  it('測定済みのスキルだけを返す', () => {
    const profile = computeSkillProfile({
      ...empty,
      results: makeSeries(3, () => ({ trainingType: 'comprehension', comprehensionScore: 80 })),
    })
    expect(measuredSkills(profile).map((m) => m.id)).toEqual(['comprehension'])
  })
})
