import { describe, expect, it } from 'vitest'
import { CONTENT_REQUIREMENTS } from '@/core/config/training-config'
import { ALL_PASSAGES, getBaselinePassage, queryPassages, selectPassage } from './index'
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
    const passage = getBaselinePassage()
    expect(passage.characterCount).toBeGreaterThan(700)
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
