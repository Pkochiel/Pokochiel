import { describe, expect, it } from 'vitest'
import { KANA_PICKUP, buildKanaSheet, isKanaTarget } from '@/core/training/btr/kana-pickup'
import { KANA_STORIES, pickKanaStory, selectKanaQuestions } from './kana-stories'

describe('KANA_STORIES', () => {
  it('話が複数ある', () => {
    expect(KANA_STORIES.length).toBeGreaterThanOrEqual(3)
  })

  it('id が重複しない', () => {
    const ids = KANA_STORIES.map((story) => story.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const story of KANA_STORIES) {
    describe(story.title, () => {
      const sheet = buildKanaSheet(story.lines)

      it('2分では読み切れない長さがある', () => {
        // 読み切れてしまうと全員が上限に張りつき、どこまで進めたかで差がつかなくなる。
        expect(sheet.chars.length).toBeGreaterThanOrEqual(500)
      })

      it('どの行にも対象が一つはある', () => {
        // 読んだ先端は押した位置で測るので、押せる字のない行があるとそこで先端が止まる。
        for (const line of story.lines) {
          expect([...line].some(isKanaTarget)).toBe(true)
        }
      })

      it('対象の密度が偏りすぎない', () => {
        const ratio = sheet.targetCount / sheet.chars.length
        expect(ratio).toBeGreaterThan(0.06)
        expect(ratio).toBeLessThan(0.16)
      })

      it('出題できる数がある', () => {
        expect(story.questions.length).toBeGreaterThanOrEqual(KANA_PICKUP.questionCount)
      })

      it('問いの id が重複しない', () => {
        const ids = story.questions.map((question) => question.id)
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('答えが決まる行が本文の中にある', () => {
        for (const question of story.questions) {
          expect(question.afterLine).toBeGreaterThanOrEqual(0)
          expect(question.afterLine).toBeLessThan(story.lines.length)
        }
      })

      it('答えが決まる行の順に並んでいる', () => {
        const lines = story.questions.map((question) => question.afterLine)
        expect([...lines].sort((a, b) => a - b)).toEqual(lines)
      })

      it('正解と誤答が重ならない', () => {
        for (const question of story.questions) {
          expect(question.distractors).not.toContain(question.answer)
          expect(new Set(question.distractors).size).toBe(question.distractors.length)
        }
      })

      it('終盤にも問いがある', () => {
        // 手前にしか問いがないと、遠くまで読んだ人ほど読んだばかりの箇所を訊かれない。
        const last = story.questions[story.questions.length - 1]!
        expect(last.afterLine).toBeGreaterThanOrEqual(story.lines.length - 3)
      })

      it('序盤にも問いがある', () => {
        // 数行しか進めなかった回でも内容確認が成立するようにする。
        expect(story.questions[0]!.afterLine).toBeLessThanOrEqual(3)
      })
    })
  }
})

describe('pickKanaStory', () => {
  it('同じ種なら同じ話になる', () => {
    expect(pickKanaStory('2026-08-22')).toBe(pickKanaStory('2026-08-22'))
  })

  it('種が変われば別の話が出うる', () => {
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) => pickKanaStory(`day-${i}`).id),
    )
    expect(seen.size).toBeGreaterThan(1)
  })

  it('必ず一覧の中の話を返す', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(KANA_STORIES).toContain(pickKanaStory(`day-${i}`))
    }
  })
})

describe('selectKanaQuestions', () => {
  const story = KANA_STORIES[0]!

  it('読んだ範囲の問いだけを出す', () => {
    const questions = selectKanaQuestions(story, 3, 'seed')
    const reachable = story.questions.filter((question) => question.afterLine <= 3)
    for (const question of questions) {
      expect(reachable.map((r) => r.id)).toContain(question.id)
    }
  })

  it('読んでいない先の問いを出さない', () => {
    const asked = selectKanaQuestions(story, 3, 'seed').map((question) => question.id)
    const beyond = story.questions.filter((question) => question.afterLine > 3)
    for (const question of beyond) expect(asked).not.toContain(question.id)
  })

  it('一行も読めていなければ0問になる', () => {
    // 読んでいない箇所を訊けば、測るのは記憶ではなく運になる。
    expect(selectKanaQuestions(story, -1, 'seed')).toEqual([])
  })

  it('最後まで読んでも出題数を超えない', () => {
    expect(selectKanaQuestions(story, story.lines.length, 'seed')).toHaveLength(
      KANA_PICKUP.questionCount,
    )
  })

  it('読んだ範囲に足りなければあるだけ出す', () => {
    const questions = selectKanaQuestions(story, 2, 'seed')
    expect(questions.length).toBeLessThanOrEqual(KANA_PICKUP.questionCount)
    expect(questions.length).toBeGreaterThan(0)
  })

  it('同じ問いを二度出さない', () => {
    const ids = selectKanaQuestions(story, story.lines.length, 'seed').map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('読んだ範囲全体に散らす', () => {
    // 手前に固まると、遠くまで読んだ人ほど読んだばかりの箇所を訊かれずに終わる。
    const questions = selectKanaQuestions(story, story.lines.length, 'seed')
    const reachable = story.questions.map((question) => question.id)
    expect(questions[0]!.id).toBe(reachable[0])
    expect(questions[questions.length - 1]!.id).toBe(reachable[reachable.length - 1])
  })

  it('選択肢は4つで、正解がひとつ入っている', () => {
    for (const question of selectKanaQuestions(story, story.lines.length, 'seed')) {
      expect(question.choices).toHaveLength(4)
      expect(question.choices.filter((c) => c.id === question.correctChoiceId)).toHaveLength(1)
    }
  })

  it('正解の位置は種で決まり、毎回同じにならない', () => {
    const positionAt = (seed: string) =>
      selectKanaQuestions(story, story.lines.length, seed).map((question) =>
        question.choices.findIndex((choice) => choice.id === question.correctChoiceId),
      )
    expect(positionAt('a')).toEqual(positionAt('a'))
    // 正解が常に同じ位置だと、読まずに位置だけで当てられてしまう。
    const positions = new Set(
      Array.from({ length: 12 }, (_, i) => positionAt(`s${i}`)).flat(),
    )
    expect(positions.size).toBeGreaterThan(1)
  })

  it('出題数を指定できる', () => {
    expect(selectKanaQuestions(story, story.lines.length, 'seed', 2)).toHaveLength(2)
    expect(selectKanaQuestions(story, story.lines.length, 'seed', 0)).toEqual([])
  })
})
