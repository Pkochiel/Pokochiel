import { describe, expect, it } from 'vitest'
import {
  SPEED_BOARD,
  applySteps,
  buildSpeedBoardQuestions,
  centerIndex,
  scoreSpeedBoard,
} from './speed-board'

const questions = (level = 0, seed = 'day') => buildSpeedBoardQuestions({ seed, level })

describe('centerIndex', () => {
  it('5×5 の真ん中は 12', () => {
    expect(centerIndex(5)).toBe(12)
  })
})

describe('applySteps', () => {
  it('真ん中から右に2動くと右端になる', () => {
    // 5×5 の真ん中は (2,2)。右に2で (4,2) ＝ 添字 14。
    expect(applySteps([{ direction: 'right', distance: 2 }], 5)).toBe(14)
  })

  it('上に動くと行が減る', () => {
    expect(applySteps([{ direction: 'up', distance: 2 }], 5)).toBe(2)
  })

  it('複数の指示を順に適用する', () => {
    // (2,2) → 右2 → (4,2) → 上1 → (4,1) ＝ 添字 9
    expect(
      applySteps(
        [
          { direction: 'right', distance: 2 },
          { direction: 'up', distance: 1 },
        ],
        5,
      ),
    ).toBe(9)
  })

  it('指示がなければ真ん中のまま', () => {
    expect(applySteps([], 5)).toBe(centerIndex(5))
  })
})

describe('buildSpeedBoardQuestions', () => {
  it('設定どおりの問数を作る', () => {
    expect(questions()).toHaveLength(SPEED_BOARD.questionCount)
  })

  it('答えが必ず盤の中に収まる', () => {
    // 盤の外へ出る指示は作らない。「盤の外だから答えられない」は測りたいものではない。
    const cells = SPEED_BOARD.size * SPEED_BOARD.size
    for (const question of questions()) {
      expect(question.answerIndex).toBeGreaterThanOrEqual(0)
      expect(question.answerIndex).toBeLessThan(cells)
    }
  })

  it('答えが指示どおりの位置と一致する', () => {
    for (const question of questions()) {
      expect(applySteps(question.steps, SPEED_BOARD.size)).toBe(question.answerIndex)
    }
  })

  it('級が上がると手数が増える', () => {
    expect(questions(0)[0]?.steps).toHaveLength(1)
    expect(questions(1)[0]?.steps).toHaveLength(2)
    expect(questions(2)[0]?.steps).toHaveLength(3)
  })

  it('同じ向きを続けない', () => {
    // 「右に1、右に1」は「右に2」と同じで、手数だけが水増しになる。
    for (const question of questions(3)) {
      for (let i = 1; i < question.steps.length; i += 1) {
        expect(question.steps[i]?.direction).not.toBe(question.steps[i - 1]?.direction)
      }
    }
  })

  it('動く距離が 1 以上ある', () => {
    for (const question of questions(2)) {
      for (const step of question.steps) expect(step.distance).toBeGreaterThanOrEqual(1)
    }
  })

  it('答えが1か所に偏らない', () => {
    const answers = new Set(questions(2).map((q) => q.answerIndex))
    expect(answers.size).toBeGreaterThan(5)
  })

  it('id が重複しない', () => {
    const ids = questions().map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('同じ種なら同じ出題になる', () => {
    expect(questions(0, 'x')).toEqual(questions(0, 'x'))
  })

  it('種が変われば出題が変わる', () => {
    expect(questions(0, 'x')).not.toEqual(questions(0, 'y'))
  })

  it('級が上限を超えても落ちない', () => {
    expect(buildSpeedBoardQuestions({ seed: 'day', level: 99 })).toHaveLength(
      SPEED_BOARD.questionCount,
    )
  })

  it('問数や盤が 0 以下なら出題しない', () => {
    expect(buildSpeedBoardQuestions({ seed: 'day', count: 0 })).toEqual([])
    expect(buildSpeedBoardQuestions({ seed: 'day', size: 0 })).toEqual([])
  })
})

describe('scoreSpeedBoard', () => {
  const allCorrect = () =>
    new Map(questions().map((question) => [question.id, question.answerIndex]))

  it('全問正解なら 100%', () => {
    const result = scoreSpeedBoard(questions(), allCorrect())
    expect(result.correct).toBe(SPEED_BOARD.questionCount)
    expect(result.accuracy).toBe(100)
  })

  it('誤答を数える', () => {
    const answers = allCorrect()
    const first = questions()[0]!
    answers.set(first.id, (first.answerIndex + 1) % 25)
    const result = scoreSpeedBoard(questions(), answers)
    expect(result.wrong).toBe(1)
  })

  it('未回答を数える', () => {
    const result = scoreSpeedBoard(questions(), new Map())
    expect(result.unanswered).toBe(SPEED_BOARD.questionCount)
    expect(result.accuracy).toBe(0)
  })

  it('正答率の分母は出題数', () => {
    // 1問だけ答えて正解しても 100% にはしない。時間内にどれだけ処理できたかを見る種目のため。
    const first = questions()[0]!
    const answers = new Map([[first.id, first.answerIndex]])
    expect(scoreSpeedBoard(questions(), answers).accuracy).toBeLessThan(10)
  })

  it('出題がなければ 0 を返す', () => {
    expect(scoreSpeedBoard([], new Map())).toEqual({
      correct: 0,
      wrong: 0,
      unanswered: 0,
      total: 0,
      accuracy: 0,
    })
  })
})
