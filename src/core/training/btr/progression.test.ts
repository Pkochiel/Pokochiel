import { describe, expect, it } from 'vitest'
import { BTR_EXERCISES, btrExercise, type BtrExercise } from './exercises'
import { SACCADE } from './saccade'
import {
  LEVEL_RULES,
  currentLevel,
  judgeBtr,
  levelLabel,
  levelRuleFor,
  nextLevel,
  requiredScoreAt,
  timeLimitAt,
  topLevel,
} from './progression'

const LEVELED = BTR_EXERCISES.filter((spec) => spec.leveled).map((spec) => spec.id)
const UNLEVELED = BTR_EXERCISES.filter((spec) => !spec.leveled).map((spec) => spec.id)

describe('LEVEL_RULES', () => {
  it.each(LEVELED)('%s にははしごがある', (exercise) => {
    expect(levelRuleFor(exercise)).not.toBeNull()
  })

  it.each(UNLEVELED)('%s にははしごを持たせない', (exercise) => {
    // 課す条件が変わらない種目に段はない。
    expect(levelRuleFor(exercise)).toBeNull()
  })

  it('制限時間は段が上がるほど短くなる', () => {
    // 上達を「同じ課題を短い時間でこなせるか」で測るのがこの方式の要点。
    for (const [exercise, rule] of Object.entries(LEVEL_RULES)) {
      const limits = rule.timeLimits
      for (let i = 1; i < limits.length; i += 1) {
        expect(limits[i]!, exercise).toBeLessThan(limits[i - 1]!)
      }
    }
  })

  it('どの段も0より長い', () => {
    for (const rule of Object.values(LEVEL_RULES)) {
      for (const limit of rule.timeLimits) expect(limit).toBeGreaterThan(0)
    }
  })

  it('下がる条件は上がる条件より緩い', () => {
    // 逆になっていると、同じ回で「上がる」と「下がる」が同時に立つ。
    for (const [exercise, rule] of Object.entries(LEVEL_RULES)) {
      if (rule.advanceScore > 0) {
        expect(rule.fallbackScore, exercise).toBeLessThan(rule.advanceScore)
      }
      if (rule.advanceAccuracy !== null && rule.fallbackAccuracy !== null) {
        expect(rule.fallbackAccuracy, exercise).toBeLessThan(rule.advanceAccuracy)
      }
    }
  })

  it('段が2つ以上ある', () => {
    // 1段しかないはしごは上がりようがない。
    for (const [exercise, rule] of Object.entries(LEVEL_RULES)) {
      expect(rule.timeLimits.length, exercise).toBeGreaterThan(1)
    }
  })
})

describe('timeLimitAt', () => {
  it('段に応じた制限時間を返す', () => {
    const rule = levelRuleFor('logical_test')!
    expect(timeLimitAt('logical_test', 0)).toBe(rule.timeLimits[0])
    expect(timeLimitAt('logical_test', 2)).toBe(rule.timeLimits[2])
  })

  it('はしごの外を求められても端に寄せる', () => {
    const rule = levelRuleFor('logical_test')!
    expect(timeLimitAt('logical_test', -5)).toBe(rule.timeLimits[0])
    expect(timeLimitAt('logical_test', 99)).toBe(rule.timeLimits[rule.timeLimits.length - 1])
  })

  it('段を持たない種目には制限時間の段がない', () => {
    expect(timeLimitAt('breathing', 0)).toBeNull()
    expect(timeLimitAt('kana_pickup', 0)).toBeNull()
  })
})

describe('judgeBtr', () => {
  it('正確さで判定する種目', () => {
    expect(judgeBtr('logical_test', { score: 27, accuracy: 90 })).toBe('advance')
    expect(judgeBtr('logical_test', { score: 24, accuracy: 80 })).toBe('stay')
    expect(judgeBtr('logical_test', { score: 18, accuracy: 60 })).toBe('fallback')
  })

  it('主スコアで判定する種目', () => {
    expect(judgeBtr('number_random', { score: 32, accuracy: null })).toBe('advance')
    expect(judgeBtr('number_random', { score: 22, accuracy: null })).toBe('stay')
    expect(judgeBtr('number_random', { score: 10, accuracy: null })).toBe('fallback')
  })

  it('両方を課す種目は片方だけでは上がらない', () => {
    // 正確さだけ見ると、ゆっくり確実に拾って100%を保つ人が上がりつづける。
    expect(judgeBtr('speed_check', { score: 6, accuracy: 100 })).toBe('stay')
    // 主スコアだけ見ると、当てずっぽうで数を稼ぐ人が上がってしまう。
    expect(judgeBtr('speed_check', { score: 10, accuracy: 70 })).toBe('stay')
    expect(judgeBtr('speed_check', { score: 10, accuracy: 100 })).toBe('advance')
  })

  it('下限を割れば下がる', () => {
    expect(judgeBtr('speed_check', { score: 3, accuracy: 100 })).toBe('fallback')
    expect(judgeBtr('speed_check', { score: 10, accuracy: 40 })).toBe('fallback')
  })

  it('正確さを見る種目に正確さが来なければ上げない', () => {
    // 分からないものを「満たした」とみなさない。
    expect(judgeBtr('logical_test', { score: 30, accuracy: null })).toBe('stay')
  })

  it.each(UNLEVELED)('%s は常に据え置き', (exercise) => {
    expect(judgeBtr(exercise, { score: 999, accuracy: 100 })).toBe('stay')
  })
})

describe('nextLevel', () => {
  it('上がると1つ進む', () => {
    expect(nextLevel('logical_test', 1, 'advance')).toBe(2)
  })

  it('下がると1つ戻る', () => {
    expect(nextLevel('logical_test', 2, 'fallback')).toBe(1)
  })

  it('据え置きなら変わらない', () => {
    expect(nextLevel('logical_test', 2, 'stay')).toBe(2)
  })

  it('いちばん上より先へは行かない', () => {
    const top = topLevel('logical_test')
    expect(nextLevel('logical_test', top, 'advance')).toBe(top)
  })

  it('いちばん下より後ろへは行かない', () => {
    expect(nextLevel('logical_test', 0, 'fallback')).toBe(0)
  })

  it('はしごの外の段を渡されても端に寄せる', () => {
    expect(nextLevel('logical_test', 99, 'stay')).toBe(topLevel('logical_test'))
    expect(nextLevel('logical_test', -3, 'stay')).toBe(0)
  })
})

describe('currentLevel', () => {
  const advance = (exercise: BtrExercise, level: number) => ({
    exercise,
    level,
    judgement: 'advance',
  })

  it('記録がなければ最初の段', () => {
    expect(currentLevel('logical_test', [])).toBe(0)
  })

  it('上がった回の分だけ進む', () => {
    expect(
      currentLevel('logical_test', [
        advance('logical_test', 0),
        advance('logical_test', 1),
      ]),
    ).toBe(2)
  })

  it('他の種目の記録に引きずられない', () => {
    // 級は種目ごとに独立している。得意な種目で苦手な種目まで難しくならない。
    expect(
      currentLevel('logical_test', [
        advance('speed_board', 0),
        advance('speed_board', 1),
        advance('speed_board', 2),
      ]),
    ).toBe(0)
  })

  it('上下を混ぜても最後の状態になる', () => {
    expect(
      currentLevel('logical_test', [
        advance('logical_test', 0),
        advance('logical_test', 1),
        { exercise: 'logical_test', level: 2, judgement: 'fallback' },
      ]),
    ).toBe(1)
  })

  it('判定を持たない古い記録は、そのとき使った段のままにする', () => {
    // 判定を残す前の記録が混ざっても、級が勝手に動かないこと。
    expect(currentLevel('logical_test', [{ exercise: 'logical_test', level: 3, judgement: null }])).toBe(3)
  })

  it('段を持たない種目は常に0', () => {
    expect(currentLevel('kana_pickup', [advance('kana_pickup', 3)])).toBe(0)
  })

  it('いちばん上を超えない', () => {
    const history = Array.from({ length: 30 }, () => advance('logical_test', 99))
    expect(currentLevel('logical_test', history)).toBe(topLevel('logical_test'))
  })
})

describe('topLevel', () => {
  it.each(LEVELED)('%s の上限ははしごの長さから決まる', (exercise) => {
    expect(topLevel(exercise)).toBe(levelRuleFor(exercise)!.timeLimits.length - 1)
  })

  it('段を持たない種目は0', () => {
    for (const exercise of UNLEVELED) expect(topLevel(exercise)).toBe(0)
  })
})

describe('種目一覧との対応', () => {
  it('はしごを持つ種目は leveled になっている', () => {
    for (const exercise of Object.keys(LEVEL_RULES) as BtrExercise[]) {
      expect(btrExercise(exercise).leveled, exercise).toBe(true)
    }
  })
})

describe('levelLabel', () => {
  it('数字が小さいほど上の級になる', () => {
    // 10級 → 1級 と上がっていく数え方に合わせる。
    const rungs = levelRuleFor('logical_test')!.timeLimits.length
    expect(levelLabel('logical_test', 0)).toBe(`${rungs}級`)
    expect(levelLabel('logical_test', rungs - 1)).toBe('1級')
  })

  it('はしごの外を渡されても端に寄せる', () => {
    expect(levelLabel('logical_test', 99)).toBe('1級')
    expect(levelLabel('logical_test', -3)).toBe(
      `${levelRuleFor('logical_test')!.timeLimits.length}級`,
    )
  })

  it('段を持たない種目に級はない', () => {
    expect(levelLabel('breathing', 0)).toBeNull()
    expect(levelLabel('kana_pickup', 0)).toBeNull()
  })
})

describe('1回あたりの目安が段になる種目（サッケイド）', () => {
  it('段が上がるほど求める往復数が増える', () => {
    // 30秒は変わらないので、段が上がっても課題そのものは難しくならない。
    // 求める数を増やさないと、同じ成績で上がりつづけてしまう。
    const rule = levelRuleFor('saccade')!
    const required = rule.timeLimits.map((_, level) =>
      requiredScoreAt(rule, level, 'advance'),
    )
    for (let i = 1; i < required.length; i += 1) {
      expect(required[i]!).toBeGreaterThan(required[i - 1]!)
    }
  })

  it('その段の目安に届けば上がる', () => {
    const rule = levelRuleFor('saccade')!
    const target = requiredScoreAt(rule, 2, 'advance')
    expect(judgeBtr('saccade', { score: target, accuracy: null, level: 2 })).toBe('advance')
    expect(judgeBtr('saccade', { score: target - 1, accuracy: null, level: 2 })).toBe('stay')
  })

  it('前の段で上がれた成績が、次の段では上がれない', () => {
    // ここが壊れていると、一度上がったあと同じ成績で最上段まで行ってしまう。
    const rule = levelRuleFor('saccade')!
    const atLevel0 = requiredScoreAt(rule, 0, 'advance')
    expect(judgeBtr('saccade', { score: atLevel0, accuracy: null, level: 0 })).toBe('advance')
    expect(judgeBtr('saccade', { score: atLevel0, accuracy: null, level: 1 })).toBe('stay')
  })

  it('半分にも届かなければ下がる', () => {
    const rule = levelRuleFor('saccade')!
    const target = requiredScoreAt(rule, 3, 'advance')
    expect(
      judgeBtr('saccade', { score: Math.floor(target / 2) - 1, accuracy: null, level: 3 }),
    ).toBe('fallback')
  })

  it('正確さを見ない', () => {
    // 自分で数えた往復数しかないので、正確さという数字が存在しない。
    const rule = levelRuleFor('saccade')!
    expect(rule.advanceAccuracy).toBeNull()
    expect(
      judgeBtr('saccade', { score: requiredScoreAt(rule, 0, 'advance'), accuracy: null, level: 0 }),
    ).toBe('advance')
  })

  it('ほかの種目は段によって閾値が変わらない', () => {
    // 制限時間が縮むぶん課題そのものが難しくなるので、求めるスコアは据え置きでよい。
    const rule = levelRuleFor('logical_test')!
    expect(requiredScoreAt(rule, 0, 'advance')).toBe(requiredScoreAt(rule, 4, 'advance'))
  })
})

describe('サッケイドの閾値（1往復＝8本）', () => {
  it('1往復が8本ぶんとして数えられている', () => {
    // 30秒 ÷（1本の目安 × 8本）が、その段で求める往復数になる。
    const rule = levelRuleFor('saccade')!
    for (const [level, interval] of rule.timeLimits.entries()) {
      const expected = Math.max(1, Math.round(SACCADE.durationMs / (interval * SACCADE.lines)))
      expect(requiredScoreAt(rule, level, 'advance'), `${level} 段`).toBe(expected)
    }
  })

  it('求める往復数が現実的な範囲に収まる', () => {
    // 1往復ごとに押すので、30秒で数十回も押させる形にはしない。
    const rule = levelRuleFor('saccade')!
    for (const [level] of rule.timeLimits.entries()) {
      const required = requiredScoreAt(rule, level, 'advance')
      expect(required).toBeGreaterThanOrEqual(3)
      expect(required).toBeLessThanOrEqual(20)
    }
  })
})
