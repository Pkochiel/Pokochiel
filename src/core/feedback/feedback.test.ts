import { describe, expect, it } from 'vitest'
import type { SkillId, SkillProfile, SkillState } from '../types/skill'
import { SKILL_IDS } from '../types/skill'
import {
  hasEnoughDataForFeedback,
  ruleBasedFeedback,
  type FeedbackGenerator,
  type TrainingFeedbackInput,
} from './feedback'

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
const strong = (score = 90) => ({ score, state: 'strong' as const })
const normal = (score = 65) => ({ score, state: 'normal' as const })

const trainingInput = (overrides: Partial<TrainingFeedbackInput> = {}): TrainingFeedbackInput => ({
  trainingType: 'speed_push',
  cpm: 700,
  targetCpm: 700,
  comprehensionScore: 80,
  accuracyScore: null,
  immediateRecallScore: null,
  previousCpm: 700,
  previousComprehension: 80,
  ...overrides,
})

describe('ruleBasedFeedback.forTraining', () => {
  it('速度が上がって理解も保てていれば肯定的に伝える', () => {
    const [message] = ruleBasedFeedback.forTraining(
      trainingInput({ cpm: 800, previousCpm: 700, comprehensionScore: 82 }),
    )
    expect(message?.tone).toBe('positive')
    expect(message?.text).toContain('理解度も保てて')
  })

  it('速度が上がっても理解が落ちていれば注意を返す', () => {
    const [message] = ruleBasedFeedback.forTraining(
      trainingInput({ cpm: 800, previousCpm: 700, comprehensionScore: 60, previousComprehension: 85 }),
    )
    expect(message?.tone).toBe('caution')
    expect(message?.text).toContain('速度を戻して')
  })

  it('速度が上がったこと自体を成果として扱わない', () => {
    const messages = ruleBasedFeedback.forTraining(
      trainingInput({ cpm: 900, previousCpm: 600, comprehensionScore: 40, previousComprehension: 85 }),
    )
    expect(messages.every((m) => m.tone !== 'positive')).toBe(true)
  })

  it('Variable Speed で主張を読み飛ばした場合に指摘する', () => {
    const messages = ruleBasedFeedback.forTraining(
      trainingInput({ trainingType: 'variable_speed', missedSlowSegments: 2 }),
    )
    expect(messages.some((m) => m.text.includes('速いまま通過'))).toBe(true)
  })

  it('Meaning Flash の正答率に応じて次の調整を伝える', () => {
    const high = ruleBasedFeedback.forTraining(
      trainingInput({ trainingType: 'meaning_flash', accuracyScore: 90 }),
    )
    const low = ruleBasedFeedback.forTraining(
      trainingInput({ trainingType: 'meaning_flash', accuracyScore: 30 }),
    )
    expect(high.some((m) => m.tone === 'positive')).toBe(true)
    expect(low.some((m) => m.tone === 'caution')).toBe(true)
  })

  it('Prediction の結果に応じて読み方の手がかりを返す', () => {
    const messages = ruleBasedFeedback.forTraining(
      trainingInput({ trainingType: 'prediction_reading', accuracyScore: 20 }),
    )
    expect(messages.some((m) => m.text.includes('最初の一文'))).toBe(true)
  })

  it('Regression の判定を言い換えて返す', () => {
    const messages = ruleBasedFeedback.forTraining(
      trainingInput({ trainingType: 'regression_control', regressionVerdict: 'too_fast' }),
    )
    expect(messages.some((m) => m.tone === 'caution')).toBe(true)
  })

  it('想起が低ければ具体的な対処を返す', () => {
    const messages = ruleBasedFeedback.forTraining(
      trainingInput({ trainingType: 'immediate_recall', immediateRecallScore: 25 }),
    )
    expect(messages.some((m) => m.text.includes('見出し'))).toBe(true)
  })

  it('比較材料がなくても必ず何か返す', () => {
    const messages = ruleBasedFeedback.forTraining(
      trainingInput({ previousCpm: null, previousComprehension: null }),
    )
    expect(messages.length).toBeGreaterThan(0)
  })
})

describe('ruleBasedFeedback.forSession', () => {
  it('速度上昇と理解維持を1文で伝える', () => {
    const [message] = ruleBasedFeedback.forSession({
      profile: profileOf(),
      cpm: 800,
      comprehension: 85,
      immediateRecall: 75,
      previousCpm: 700,
      previousComprehension: 84,
    })
    expect(message?.text).toContain('理解度も維持')
  })

  it('速度上昇と理解低下では明日の配分方針まで伝える', () => {
    const [message] = ruleBasedFeedback.forSession({
      profile: profileOf(),
      cpm: 850,
      comprehension: 70,
      immediateRecall: 60,
      previousCpm: 700,
      previousComprehension: 85,
    })
    expect(message?.tone).toBe('caution')
    expect(message?.text).toContain('Speed Push を弱め')
  })

  it('意味把握が速く翌日 Recall が弱い傾向を指摘する', () => {
    const messages = ruleBasedFeedback.forSession({
      profile: profileOf({ meaning_extraction: strong(), delayed_recall: weak() }),
      cpm: null,
      comprehension: null,
      immediateRecall: null,
      previousCpm: null,
      previousComprehension: null,
    })
    expect(messages.some((m) => m.text.includes('翌日 Recall が弱い'))).toBe(true)
  })

  it('速度が強く理解が弱い場合は速度を上げない方針を伝える', () => {
    const messages = ruleBasedFeedback.forSession({
      profile: profileOf({ reading_speed: strong(), comprehension: weak() }),
      cpm: null,
      comprehension: null,
      immediateRecall: null,
      previousCpm: null,
      previousComprehension: null,
    })
    expect(messages.some((m) => m.text.includes('速度は上げず'))).toBe(true)
  })

  it('弱点があれば次の配分方針を伝える', () => {
    const messages = ruleBasedFeedback.forSession({
      profile: profileOf({ structure_recognition: weak(20), comprehension: normal() }),
      cpm: null,
      comprehension: null,
      immediateRecall: null,
      previousCpm: null,
      previousComprehension: null,
    })
    expect(messages.some((m) => m.text.includes('Structure Recognition'))).toBe(true)
  })

  it('測定が進んでいなければその旨を伝える', () => {
    const messages = ruleBasedFeedback.forSession({
      profile: profileOf(),
      cpm: null,
      comprehension: null,
      immediateRecall: null,
      previousCpm: null,
      previousComprehension: null,
    })
    expect(messages.some((m) => m.text.includes('測定できていません'))).toBe(true)
  })

  it('必ず1件以上返す', () => {
    const messages = ruleBasedFeedback.forSession({
      profile: profileOf(Object.fromEntries(SKILL_IDS.map((id) => [id, normal()]))),
      cpm: 700,
      comprehension: 80,
      immediateRecall: 70,
      previousCpm: 700,
      previousComprehension: 80,
    })
    expect(messages.length).toBeGreaterThan(0)
  })
})

describe('差し替え可能性', () => {
  it('同じインタフェースで別の生成器に置き換えられる', () => {
    const aiCoach: FeedbackGenerator = {
      forTraining: () => [{ tone: 'positive', text: 'AI からの助言' }],
      forSession: () => [{ tone: 'neutral', text: 'AI からのまとめ' }],
    }
    expect(aiCoach.forTraining(trainingInput())[0]?.text).toBe('AI からの助言')
  })
})

describe('hasEnoughDataForFeedback', () => {
  it('実測が1件もなければ false', () => {
    expect(hasEnoughDataForFeedback(profileOf())).toBe(false)
  })

  it('実測があれば true', () => {
    expect(hasEnoughDataForFeedback(profileOf({ comprehension: normal() }))).toBe(true)
  })
})
