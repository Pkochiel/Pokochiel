import { describe, expect, it } from 'vitest'
import {
  DIRECTION_KANJI,
  SPEED_CHECK,
  allDirectionCombos,
  buildSpeedCheckQuestions,
  comboDistance,
  scoreSpeedCheck,
} from './speed-check'

const questions = (seed = 'day') => buildSpeedCheckQuestions({ seed })

describe('allDirectionCombos', () => {
  it('4字の3文字並びで64通りになる', () => {
    expect(allDirectionCombos()).toHaveLength(4 ** SPEED_CHECK.length)
  })

  it('重複がない', () => {
    const combos = allDirectionCombos()
    expect(new Set(combos).size).toBe(combos.length)
  })

  it('方角漢字だけで作る', () => {
    for (const combo of allDirectionCombos()) {
      for (const char of combo) expect(DIRECTION_KANJI).toContain(char)
    }
  })

  it('同じ字の重なりも含める', () => {
    // 3字で重なりを禁じると24通りしか作れず、選択肢を並べるのに足りない。
    expect(allDirectionCombos()).toContain('東東東')
  })

  it('どれも決められた字数になる', () => {
    for (const combo of allDirectionCombos()) {
      expect([...combo]).toHaveLength(SPEED_CHECK.length)
    }
  })

  it('字数が 0 以下なら空', () => {
    expect(allDirectionCombos(0)).toEqual([])
  })
})

describe('comboDistance', () => {
  it('同じなら 0', () => {
    expect(comboDistance('東西南', '東西南')).toBe(0)
  })

  it('違う位置の数を返す', () => {
    expect(comboDistance('東西南', '東西北')).toBe(1)
    expect(comboDistance('東西南', '東北北')).toBe(2)
    expect(comboDistance('東西南', '西南北')).toBe(3)
  })
})

describe('buildSpeedCheckQuestions', () => {
  it('設定どおりの問数を作る', () => {
    expect(questions()).toHaveLength(SPEED_CHECK.questionCount)
  })

  it('1問ずつ選択肢を並べる', () => {
    for (const question of questions()) {
      expect(question.options).toHaveLength(SPEED_CHECK.optionCount)
    }
  })

  it('お題が1問ごとに違う', () => {
    // 同じお題が続くと、2問目からは覚えた形を照合するだけになる。
    const targets = questions().map((question) => question.target)
    expect(new Set(targets).size).toBe(targets.length)
  })

  it('組み合わせより多く出題しても、続けて同じお題にならない', () => {
    const many = buildSpeedCheckQuestions({ seed: 'day', count: 100 })
    const targets = many.map((question) => question.target)
    for (let i = 1; i < targets.length; i += 1) {
      expect(targets[i], `${i} 問目`).not.toBe(targets[i - 1])
    }
  })

  it('お題が正解の位置にある', () => {
    for (const question of questions()) {
      expect(question.options[question.answerPosition]?.label).toBe(question.target)
    }
  })

  it('お題が選択肢にちょうど1つだけある', () => {
    // 2つあると正解が割れる。
    for (const question of questions()) {
      const matches = question.options.filter((option) => option.label === question.target)
      expect(matches).toHaveLength(1)
    }
  })

  it('選択肢に重複がない', () => {
    for (const question of questions()) {
      const labels = question.options.map((option) => option.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('position が並びの添字と一致する', () => {
    for (const question of questions()) {
      question.options.forEach((option, index) => expect(option.position).toBe(index))
    }
  })

  it('1字違いを全部並べる', () => {
    // 頭の1字だけ見て決めると必ず外れるようにする。
    for (const question of questions().slice(0, 5)) {
      const near = question.options.filter(
        (option) => comboDistance(option.label, question.target) === 1,
      )
      // 3か所 × 3通り = 9。
      expect(near).toHaveLength(9)
    }
  })

  it('正解の位置が毎回同じにならない', () => {
    const positions = new Set(questions().map((question) => question.answerPosition))
    expect(positions.size).toBeGreaterThan(5)
  })

  it('id が重複しない', () => {
    const ids = questions().map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('同じ種なら同じ出題になる', () => {
    expect(questions('x')).toEqual(questions('x'))
  })

  it('種が変われば出題が変わる', () => {
    expect(questions('x')).not.toEqual(questions('y'))
  })

  it('問数や選択肢数が 0 以下なら出題しない', () => {
    expect(buildSpeedCheckQuestions({ seed: 'd', count: 0 })).toEqual([])
    expect(buildSpeedCheckQuestions({ seed: 'd', optionCount: 0 })).toEqual([])
  })

  it('選択肢を増やしても重複させない', () => {
    // 64通りしかないので、それを超えて求められたらあるだけ並べる。
    const [question] = buildSpeedCheckQuestions({ seed: 'd', count: 1, optionCount: 100 })
    const labels = question!.options.map((option) => option.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels.length).toBeLessThanOrEqual(allDirectionCombos().length)
  })
})

describe('制限時間の段階', () => {
  it('短くなる順に並んでいる', () => {
    const limits = SPEED_CHECK.timeLimits
    for (let i = 1; i < limits.length; i += 1) {
      expect(limits[i]!).toBeLessThan(limits[i - 1]!)
    }
  })

  it('上がる基準が戻る基準より高い', () => {
    expect(SPEED_CHECK.advanceAccuracy).toBeGreaterThan(SPEED_CHECK.fallbackAccuracy)
  })
})

describe('scoreSpeedCheck', () => {
  const allCorrect = () =>
    new Map(questions().map((question) => [question.id, question.answerPosition]))

  it('全問正解なら 100%', () => {
    const result = scoreSpeedCheck(questions(), allCorrect())
    expect(result.correct).toBe(SPEED_CHECK.questionCount)
    expect(result.accuracy).toBe(100)
  })

  it('誤答を数える', () => {
    const answers = allCorrect()
    const first = questions()[0]!
    answers.set(first.id, (first.answerPosition + 1) % SPEED_CHECK.optionCount)
    const result = scoreSpeedCheck(questions(), answers)
    expect(result.wrong).toBe(1)
    expect(result.correct).toBe(SPEED_CHECK.questionCount - 1)
  })

  it('手つかずを数える', () => {
    const result = scoreSpeedCheck(questions(), new Map())
    expect(result.unanswered).toBe(SPEED_CHECK.questionCount)
    expect(result.accuracy).toBe(0)
  })

  it('正答率の分母は全問', () => {
    // 時間内にどれだけ処理できたかを見るので、解いた分だけで割らない。
    const built = questions()
    const answers = new Map([[built[0]!.id, built[0]!.answerPosition]])
    expect(scoreSpeedCheck(built, answers).accuracy).toBe(
      Math.round((1 / SPEED_CHECK.questionCount) * 100),
    )
  })

  it('出題がなければ 0', () => {
    expect(scoreSpeedCheck([], new Map()).accuracy).toBe(0)
  })
})
