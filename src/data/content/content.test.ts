import { describe, expect, it } from 'vitest'
import { CONTENT_REQUIREMENTS } from '@/core/config/training-config'
import {
  ALL_PASSAGES,
  BASELINE_POOL,
  queryPassages,
  selectBaselinePassage,
  selectPassage,
} from './index'
import { countCharacters, difficultyDeviation } from './define-passage'
import { passageSchema } from './schema'

describe('seed content', () => {
  it('MVP に必要な本数がある（20〜30本）', () => {
    expect(ALL_PASSAGES.length).toBeGreaterThanOrEqual(20)
    expect(ALL_PASSAGES.length).toBeLessThanOrEqual(30)
  })

  it('id が重複しない', () => {
    const ids = ALL_PASSAGES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('7 カテゴリすべてに教材がある', () => {
    const categories = new Set(ALL_PASSAGES.map((p) => p.category))
    expect(categories).toEqual(
      new Set(['business', 'technology', 'economics', 'psychology', 'science', 'history', 'general']),
    )
  })

  it('難易度が 1〜5 に分散している', () => {
    const levels = new Set(ALL_PASSAGES.map((p) => p.difficulty))
    expect(levels.size).toBeGreaterThanOrEqual(4)
  })

  it.each(ALL_PASSAGES.map((p) => [p.id, p] as const))('%s がスキーマに適合する', (_id, passage) => {
    expect(() => passageSchema.parse(passage)).not.toThrow()
  })

  describe.each(ALL_PASSAGES.map((p) => [p.id, p] as const))('%s', (_id, passage) => {
    it('チャンクを連結すると本文に一致する（意味単位が本文を過不足なく覆う）', () => {
      expect(passage.chunks.join('')).toBe(passage.content.split('\n').join(''))
    })

    it('characterCount が本文から算出した値と一致する', () => {
      expect(passage.characterCount).toBe(countCharacters(passage.content))
    })

    it('本文がトレーニングに足る長さである', () => {
      expect(passage.characterCount).toBeGreaterThanOrEqual(200)
      expect(passage.characterCount).toBeLessThanOrEqual(2000)
    })

    it(`段落が ${CONTENT_REQUIREMENTS.minParagraphs} 以上ある`, () => {
      expect(passage.paragraphs.length).toBeGreaterThanOrEqual(CONTENT_REQUIREMENTS.minParagraphs)
    })

    it('各段落の要旨選択肢に正解がちょうど1つある', () => {
      for (const paragraph of passage.paragraphs) {
        expect(paragraph.summaryChoices.filter((c) => c.correct)).toHaveLength(1)
        expect(paragraph.summaryChoices.length).toBeGreaterThanOrEqual(4)
      }
    })

    it(`設問が ${CONTENT_REQUIREMENTS.minQuestions} 問以上ある`, () => {
      expect(passage.questions.length).toBeGreaterThanOrEqual(CONTENT_REQUIREMENTS.minQuestions)
    })

    it(`設問が ${CONTENT_REQUIREMENTS.minQuestionTypes} 種類以上を含む`, () => {
      const types = new Set(passage.questions.map((q) => q.type))
      expect(types.size).toBeGreaterThanOrEqual(CONTENT_REQUIREMENTS.minQuestionTypes)
    })

    it('推論を問う設問を含む（単純な暗記問題だけにしない）', () => {
      const types = passage.questions.map((q) => q.type)
      expect(types).toContain(CONTENT_REQUIREMENTS.requiredQuestionType)
    })

    it('各設問の正解が選択肢の中に存在する', () => {
      for (const question of passage.questions) {
        const ids = question.choices.map((c) => c.id)
        expect(ids).toContain(question.correctChoiceId)
        expect(new Set(ids).size).toBe(ids.length)
      }
    })

    it('選択肢の文言が重複しない', () => {
      for (const question of passage.questions) {
        const texts = question.choices.map((c) => c.text)
        expect(new Set(texts).size).toBe(texts.length)
      }
    })

    it('正解の位置が先頭に固定されていない（決定的にシャッフルされている）', () => {
      // 個別の問題では先頭になることもあるため、教材全体での偏りを見る
      const firstIsCorrect = passage.questions.filter(
        (q) => q.choices[0]?.id === q.correctChoiceId,
      ).length
      expect(firstIsCorrect).toBeLessThan(passage.questions.length)
    })

    it(`Key Points が ${CONTENT_REQUIREMENTS.minKeyPoints}〜${CONTENT_REQUIREMENTS.maxKeyPoints} 件ある`, () => {
      expect(passage.keyPoints.length).toBeGreaterThanOrEqual(CONTENT_REQUIREMENTS.minKeyPoints)
      expect(passage.keyPoints.length).toBeLessThanOrEqual(CONTENT_REQUIREMENTS.maxKeyPoints)
    })

    it('著者が付けた難易度が、要因からの算出値と ±1 以内で整合する', () => {
      expect(difficultyDeviation(passage)).toBeLessThanOrEqual(1)
    })

    it('Prediction Reading の停止位置が最終段落ではない', () => {
      const lastIndex = passage.paragraphs.length - 1
      const stops = passage.paragraphs.filter((p) => p.predictionStop)
      for (const stop of stops) {
        expect(stop.index).toBeLessThan(lastIndex)
      }
    })
  })
})

describe('passage selection', () => {
  it('Baseline 用の教材が取得できる', () => {
    const passage = selectBaselinePassage()
    expect(passage.characterCount).toBeGreaterThan(1200)
    expect(passage.questions.length).toBeGreaterThanOrEqual(5)
  })

  it('除外した教材は選ばれない', () => {
    const excluded = ALL_PASSAGES.slice(0, 5).map((p) => p.id)
    const results = queryPassages({ excludeIds: excluded })
    expect(results.every((p) => !excluded.includes(p.id))).toBe(true)
  })

  it('目標難易度に最も近い教材を選ぶ', () => {
    const selected = selectPassage(5)
    expect(selected?.difficulty).toBe(5)
  })

  it('同じ入力からは常に同じ教材を返す', () => {
    expect(selectPassage(3, { excludeIds: ['biz-002'] })?.id).toBe(
      selectPassage(3, { excludeIds: ['biz-002'] })?.id,
    )
  })

  it('候補がすべて除外された場合は null を返す', () => {
    expect(selectPassage(3, { excludeIds: ALL_PASSAGES.map((p) => p.id) })).toBeNull()
  })
})

describe('段落のチャンク', () => {
  it.each(ALL_PASSAGES.map((p) => [p.id, p] as const))(
    '%s は段落ごとのチャンクを連結すると段落本文に一致する',
    (_id, passage) => {
      for (const paragraph of passage.paragraphs) {
        expect(paragraph.chunks.join('')).toBe(paragraph.text)
      }
    },
  )

  it.each(ALL_PASSAGES.map((p) => [p.id, p] as const))(
    '%s は段落のチャンクの合計が教材全体のチャンクと一致する',
    (_id, passage) => {
      expect(passage.paragraphs.flatMap((p) => p.chunks)).toEqual(passage.chunks)
    },
  )
})

describe('Baseline 用教材', () => {
  it('複数用意されている（同じ文章の記憶でスコアが汚染されないようにする）', () => {
    expect(BASELINE_POOL.length).toBeGreaterThanOrEqual(3)
  })

  it('トレーニング用のプールとは分離されている', () => {
    const trainingIds = new Set(ALL_PASSAGES.map((p) => p.id))
    for (const passage of BASELINE_POOL) {
      expect(trainingIds.has(passage.id)).toBe(false)
    }
  })

  it('カテゴリが分散している', () => {
    expect(new Set(BASELINE_POOL.map((p) => p.category)).size).toBe(BASELINE_POOL.length)
  })

  it.each(BASELINE_POOL.map((p) => [p.id, p] as const))(
    '%s は測定に足る長さ（1,200〜2,000字）である',
    (_id, passage) => {
      expect(passage.characterCount).toBeGreaterThanOrEqual(1200)
      expect(passage.characterCount).toBeLessThanOrEqual(2000)
    },
  )

  it.each(BASELINE_POOL.map((p) => [p.id, p] as const))(
    '%s は難易度が Normal で揃っている（教材差でスコアが動かない）',
    (_id, passage) => {
      expect(passage.difficulty).toBe(3)
    },
  )

  it.each(BASELINE_POOL.map((p) => [p.id, p] as const))(
    '%s は Main Idea / Cause & Effect / Structure を各2問以上含む',
    (_id, passage) => {
      const count = (type: string) => passage.questions.filter((q) => q.type === type).length
      expect(count('main_idea')).toBeGreaterThanOrEqual(2)
      expect(count('cause_effect')).toBeGreaterThanOrEqual(2)
      expect(count('structure')).toBeGreaterThanOrEqual(2)
      expect(passage.questions.length).toBeGreaterThanOrEqual(8)
    },
  )

  describe('selectBaselinePassage', () => {
    it('未使用の教材を優先する', () => {
      const first = selectBaselinePassage()
      const second = selectBaselinePassage([first.id])
      expect(second.id).not.toBe(first.id)
    })

    it('すべて使い切っても教材を返す', () => {
      const used = BASELINE_POOL.map((p) => p.id)
      expect(selectBaselinePassage(used)).toBeDefined()
    })

    it('同じ入力からは常に同じ教材を返す', () => {
      expect(selectBaselinePassage(['base-001']).id).toBe(selectBaselinePassage(['base-001']).id)
    })
  })
})

describe('Prediction Reading 用の停止位置', () => {
  const withChoices = ALL_PASSAGES.flatMap((p) =>
    p.paragraphs.flatMap((paragraph) =>
      paragraph.predictionStop?.choices
        ? [{ passageId: p.id, stop: paragraph.predictionStop, index: paragraph.index }]
        : [],
    ),
  )

  it('選択肢を持つ教材が用意されている', () => {
    expect(withChoices.length).toBeGreaterThanOrEqual(5)
  })

  it.each(withChoices.map((w) => [`${w.passageId}#${w.index}`, w] as const))(
    '%s の選択肢は correct をちょうど1つ持つ',
    (_id, { stop }) => {
      const choices = stop.choices ?? []
      expect(choices.filter((c) => c.quality === 'correct')).toHaveLength(1)
      expect(choices.length).toBeGreaterThanOrEqual(3)
    },
  )

  it.each(withChoices.map((w) => [`${w.passageId}#${w.index}`, w] as const))(
    '%s の選択肢はすべて説明を持ち、文言が重複しない',
    (_id, { stop }) => {
      const choices = stop.choices ?? []
      expect(choices.every((c) => c.explanation.length > 0)).toBe(true)
      expect(new Set(choices.map((c) => c.text)).size).toBe(choices.length)
    },
  )

  it('停止位置が最終段落ではない（続きが存在する）', () => {
    for (const passage of ALL_PASSAGES) {
      const last = passage.paragraphs.length - 1
      for (const paragraph of passage.paragraphs) {
        if (paragraph.predictionStop) expect(paragraph.index).toBeLessThan(last)
      }
    }
  })
})

describe('Variable Speed Reading 用の区間', () => {
  const withSegments = ALL_PASSAGES.filter((p) => (p.speedSegments?.length ?? 0) > 0)

  it('区間を持つ教材が用意されている', () => {
    expect(withSegments.length).toBeGreaterThanOrEqual(5)
  })

  it.each(withSegments.map((p) => [p.id, p] as const))(
    '%s の区間は全段落を覆い、本文と一致する',
    (_id, passage) => {
      const segments = passage.speedSegments ?? []
      expect(segments).toHaveLength(passage.paragraphs.length)
      for (const segment of segments) {
        expect(segment.text).toBe(passage.paragraphs[segment.paragraphIndex]?.text)
      }
    },
  )

  it.each(withSegments.map((p) => [p.id, p] as const))(
    '%s は主張・根拠・具体例のいずれも含み、単調な構成になっていない',
    (_id, passage) => {
      const importances = new Set((passage.speedSegments ?? []).map((s) => s.importance))
      expect(importances.size).toBeGreaterThanOrEqual(3)
    },
  )

  it.each(withSegments.map((p) => [p.id, p] as const))(
    '%s は主張を slow、具体例や既知情報を fast に割り当てている',
    (_id, passage) => {
      for (const segment of passage.speedSegments ?? []) {
        if (segment.importance === 'claim' || segment.importance === 'key') {
          expect(segment.recommendedBand).toBe('slow')
        }
        if (segment.importance === 'example' || segment.importance === 'known') {
          expect(segment.recommendedBand).toBe('fast')
        }
      }
    },
  )
})
