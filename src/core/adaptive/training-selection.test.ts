import { describe, expect, it } from 'vitest'
import type { SkillId, SkillProfile, SkillState } from '../types/skill'
import { SKILL_IDS } from '../types/skill'
import {
  assessCoreEmphasis,
  OPTIONAL_TRAININGS,
  selectOptionalTrainings,
  unmeasuredSkills,
  type OptionalTraining,
} from './training-selection'

function profileOf(overrides: Partial<Record<SkillId, { score: number; state: SkillState }>>): SkillProfile {
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

const normal = (score = 65) => ({ score, state: 'normal' as const })
const weak = (score = 30) => ({ score, state: 'weak' as const })
const strong = (score = 90) => ({ score, state: 'strong' as const })

describe('selectOptionalTrainings', () => {
  const available = OPTIONAL_TRAININGS

  it('弱いスキルに対応するトレーニングを最優先する', () => {
    const selected = selectOptionalTrainings({
      profile: profileOf({
        meaning_extraction: weak(20),
        chunk_recognition: strong(),
        prediction: normal(),
        adaptive_reading: normal(),
        reading_speed: normal(),
      }),
      available,
      rotationSeed: '2026-08-19',
      limit: 1,
    })
    expect(selected[0]?.type).toBe('meaning_flash')
    expect(selected[0]?.state).toBe('weak')
  })

  it('未測定は weak の次に優先する（測ること自体に価値がある）', () => {
    const selected = selectOptionalTrainings({
      profile: profileOf({
        meaning_extraction: weak(20),
        chunk_recognition: normal(),
        prediction: normal(),
        adaptive_reading: normal(),
        reading_speed: normal(),
        // prediction のみ未測定にする
      }),
      available,
      rotationSeed: '2026-08-19',
      limit: 5,
    })
    const states = selected.map((s) => s.state)
    expect(states[0]).toBe('weak')
    expect(states.indexOf('normal')).toBeGreaterThan(states.indexOf('weak'))
  })

  it('strong なスキルは後回しになる', () => {
    const selected = selectOptionalTrainings({
      profile: profileOf({
        meaning_extraction: strong(),
        chunk_recognition: weak(),
        prediction: normal(),
        adaptive_reading: normal(),
        reading_speed: normal(),
      }),
      available,
      rotationSeed: '2026-08-19',
      limit: 5,
    })
    expect(selected[selected.length - 1]?.type).toBe('meaning_flash')
  })

  it('limit を超えて選ばない', () => {
    const selected = selectOptionalTrainings({
      profile: profileOf({}),
      available,
      rotationSeed: '2026-08-19',
      limit: 2,
    })
    expect(selected).toHaveLength(2)
  })

  it('limit が 0 なら何も選ばない', () => {
    expect(
      selectOptionalTrainings({
        profile: profileOf({}),
        available,
        rotationSeed: '2026-08-19',
        limit: 0,
      }),
    ).toEqual([])
  })

  it('同じ日・同じ Profile なら常に同じ結果になる', () => {
    const input = {
      profile: profileOf({}),
      available,
      rotationSeed: '2026-08-19',
      limit: 2,
    }
    expect(selectOptionalTrainings(input)).toEqual(selectOptionalTrainings(input))
  })

  it('日付が変われば、同順位の中で選ばれるものが回る', () => {
    const dates = ['2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23']
    const picks = new Set(
      dates.map(
        (date) =>
          selectOptionalTrainings({
            profile: profileOf({}),
            available,
            rotationSeed: date,
            limit: 1,
          })[0]?.type,
      ),
    )
    expect(picks.size).toBeGreaterThan(1)
  })

  it('実施できないトレーニングは候補に入らない', () => {
    const limited: OptionalTraining[] = ['meaning_flash', 'chunk_reading']
    const selected = selectOptionalTrainings({
      profile: profileOf({}),
      available: limited,
      rotationSeed: '2026-08-19',
      limit: 5,
    })
    expect(selected.every((s) => limited.includes(s.type))).toBe(true)
  })
})

describe('assessCoreEmphasis', () => {
  it('速度が弱く理解が保てていれば Speed Push を増やす', () => {
    const result = assessCoreEmphasis(
      profileOf({ reading_speed: weak(), comprehension: strong() }),
    )
    expect(result.emphasize).toContain('speed_push')
    expect(result.suppress).not.toContain('speed_push')
  })

  it('速度が高く理解が低ければ Speed Push を増やさない', () => {
    const result = assessCoreEmphasis(
      profileOf({ reading_speed: strong(), comprehension: weak() }),
    )
    expect(result.suppress).toContain('speed_push')
    expect(result.emphasize).not.toContain('speed_push')
    expect(result.emphasize).toContain('structure_reading')
    expect(result.notes.join()).toContain('速度は増やさず')
  })

  it('想起が弱ければ速度を増やさず Recall と構造把握を増やす', () => {
    const result = assessCoreEmphasis(
      profileOf({ immediate_recall: weak(), reading_speed: weak(), comprehension: normal() }),
    )
    expect(result.emphasize).toContain('immediate_recall')
    expect(result.emphasize).toContain('structure_reading')
    expect(result.suppress).toContain('speed_push')
    expect(result.emphasize).not.toContain('speed_push')
  })

  it('翌日 Recall が弱い場合も同じ扱いにする', () => {
    const result = assessCoreEmphasis(profileOf({ delayed_recall: weak() }))
    expect(result.emphasize).toContain('immediate_recall')
  })

  it('構造把握が弱ければ Structure Reading を増やす', () => {
    const result = assessCoreEmphasis(profileOf({ structure_recognition: weak() }))
    expect(result.emphasize).toContain('structure_reading')
  })

  it('弱点がなければ何も強調しない', () => {
    const result = assessCoreEmphasis(
      profileOf({
        reading_speed: normal(),
        comprehension: normal(),
        structure_recognition: normal(),
        immediate_recall: normal(),
        delayed_recall: normal(),
      }),
    )
    expect(result.emphasize).toEqual([])
    expect(result.suppress).toEqual([])
  })

  it('強調と抑制が両方に現れない', () => {
    const result = assessCoreEmphasis(
      profileOf({ reading_speed: strong(), comprehension: weak(), immediate_recall: weak() }),
    )
    for (const type of result.emphasize) {
      expect(result.suppress).not.toContain(type)
    }
  })
})

describe('unmeasuredSkills', () => {
  it('未測定のスキルを列挙する', () => {
    const skills = unmeasuredSkills(profileOf({ comprehension: normal() }))
    expect(skills).not.toContain('comprehension')
    expect(skills).toContain('prediction')
  })
})
