import { describe, expect, it } from 'vitest'
import { toLocalDate } from '../types'
import {
  latestSession,
  summarizeBtrProgress,
  summarizeReadingSpeed,
  trainingStreak,
  trendDirection,
  type BtrRecordLike,
} from './btr-progress'

const d = (value: string) => toLocalDate(value)

function record(overrides: Partial<BtrRecordLike> & { exercise: string; score: number }): BtrRecordLike {
  return {
    variant: null,
    level: null,
    judgement: null,
    lowerIsBetter: false,
    cpm: null,
    localDate: d('2026-08-22'),
    ...overrides,
  }
}

/** 日付を1日ずつずらしながら並べる。 */
function series(
  exercise: string,
  scores: readonly number[],
  overrides: Partial<BtrRecordLike> = {},
): BtrRecordLike[] {
  return scores.map((score, index) =>
    record({
      exercise,
      score,
      localDate: d(`2026-08-${String(index + 1).padStart(2, '0')}`),
      ...overrides,
    }),
  )
}

describe('trendDirection', () => {
  const points = (scores: readonly number[]) =>
    scores.map((score, i) => ({ date: d(`2026-08-${String(i + 1).padStart(2, '0')}`), score }))

  it('両側そろわないうちは判じない', () => {
    // 1回前とだけ比べると、その日の調子で上下して意味を成さない。
    expect(trendDirection(points([10, 20, 30, 40, 50]), false)).toBe('unknown')
  })

  it('伸びていれば up', () => {
    expect(trendDirection(points([10, 10, 10, 20, 20, 20]), false)).toBe('up')
  })

  it('落ちていれば down', () => {
    expect(trendDirection(points([20, 20, 20, 10, 10, 10]), false)).toBe('down')
  })

  it('わずかな揺れは横ばいとみなす', () => {
    // 測定の揺れを「伸びた」と言わない。
    expect(trendDirection(points([100, 100, 100, 102, 101, 102]), false)).toBe('flat')
  })

  it('小さいほうがよい種目では向きが逆になる', () => {
    // カウント呼吸法は回数が減るほど良い。
    expect(trendDirection(points([20, 20, 20, 10, 10, 10]), true)).toBe('up')
    expect(trendDirection(points([10, 10, 10, 20, 20, 20]), true)).toBe('down')
  })

  it('0 から動いたときも向きを出せる', () => {
    expect(trendDirection(points([0, 0, 0, 5, 5, 5]), false)).toBe('up')
    expect(trendDirection(points([0, 0, 0, 0, 0, 0]), false)).toBe('flat')
  })
})

describe('summarizeBtrProgress', () => {
  it('記録がなければ空', () => {
    expect(summarizeBtrProgress([])).toEqual([])
  })

  it('種目ごとにまとめる', () => {
    const trends = summarizeBtrProgress([
      ...series('saccade', [40, 45]),
      ...series('logical_test', [20]),
    ])
    expect(trends.map((trend) => trend.exercise)).toEqual(['saccade', 'logical_test'])
  })

  it('総合点にまとめない', () => {
    // まとめると、伸びている種目と落ちている種目が打ち消し合って見えなくなる。
    const trends = summarizeBtrProgress([
      ...series('saccade', [40, 50, 60]),
      ...series('logical_test', [30, 20, 10]),
    ])
    expect(trends).toHaveLength(2)
    expect(trends.find((t) => t.exercise === 'saccade')?.latest).toBe(60)
    expect(trends.find((t) => t.exercise === 'logical_test')?.latest).toBe(10)
  })

  it('サッケイドのたてとよこを別々に持つ', () => {
    // ひとつの推移にまとめると、その日どちらをやったかで数字が跳ねる。
    const trends = summarizeBtrProgress([
      ...series('saccade', [40, 44], { variant: 'vertical' }),
      ...series('saccade', [70, 74], { variant: 'horizontal' }),
    ])
    expect(trends).toHaveLength(2)
    expect(trends.map((trend) => trend.name).sort()).toEqual([
      'たてサッケイド',
      'よこサッケイド',
    ])
  })

  it('種目一覧の順に並べる', () => {
    // やった順に出すと、並びが日ごとに変わって見る場所を探し直すことになる。
    const trends = summarizeBtrProgress([
      ...series('paced_reading', [5]),
      ...series('breathing', [14]),
      ...series('logical_test', [20]),
    ])
    expect(trends.map((trend) => trend.exercise)).toEqual([
      'breathing',
      'logical_test',
      'paced_reading',
    ])
  })

  it('最新と最良を出す', () => {
    const [trend] = summarizeBtrProgress(series('logical_test', [20, 26, 22]))
    expect(trend?.latest).toBe(22)
    expect(trend?.best).toBe(26)
  })

  it('小さいほうがよい種目では最小値が最良', () => {
    const [trend] = summarizeBtrProgress(
      series('breathing', [18, 12, 15], { lowerIsBetter: true }),
    )
    expect(trend?.best).toBe(12)
    expect(trend?.lowerIsBetter).toBe(true)
  })

  it('点は古い順に並ぶ', () => {
    const [trend] = summarizeBtrProgress(series('logical_test', [20, 26, 22]))
    expect(trend?.points.map((point) => point.score)).toEqual([20, 26, 22])
  })

  it('点の数を絞れる', () => {
    // 多すぎると1点ずつが読めなくなる。新しいほうを残す。
    const [trend] = summarizeBtrProgress(series('logical_test', [1, 2, 3, 4, 5]), {
      maxPoints: 3,
    })
    expect(trend?.points.map((point) => point.score)).toEqual([3, 4, 5])
    // 絞っても回数そのものは数える。
    expect(trend?.attempts).toBe(5)
  })

  it('いまの級を出す', () => {
    const trends = summarizeBtrProgress([
      record({ exercise: 'logical_test', score: 30, level: 0, judgement: 'advance' }),
      record({ exercise: 'logical_test', score: 30, level: 1, judgement: 'advance' }),
    ])
    expect(trends[0]?.level).toBe(2)
    expect(trends[0]?.levelLabel).toBe('4級')
  })

  it('級を持たない種目に級を出さない', () => {
    const [trend] = summarizeBtrProgress(series('breathing', [14], { lowerIsBetter: true }))
    expect(trend?.levelLabel).toBeNull()
  })

  it('一覧にない種目は出さない', () => {
    // 消した種目の記録が残っていても画面には出さない。
    expect(summarizeBtrProgress(series('chunk_reading', [10]))).toEqual([])
  })

  it('向きを添える', () => {
    const [trend] = summarizeBtrProgress(series('logical_test', [10, 10, 10, 20, 20, 20]))
    expect(trend?.direction).toBe('up')
  })

  it('回数が足りなければ向きを判じない', () => {
    const [trend] = summarizeBtrProgress(series('logical_test', [10, 20]))
    expect(trend?.direction).toBe('unknown')
  })
})

describe('summarizeReadingSpeed', () => {
  const reading = (
    exercise: 'paced_reading' | 'normal_reading',
    cpms: readonly number[],
  ): BtrRecordLike[] =>
    cpms.map((cpm, index) =>
      record({
        exercise,
        score: 8,
        cpm,
        localDate: d(`2026-08-${String(index + 1).padStart(2, '0')}`),
      }),
    )

  it('普通読書と倍速読書を分けて持つ', () => {
    // まとめると、速く読もうとした日の数字がふだんの速さとして残る。
    const summary = summarizeReadingSpeed(
      [...reading('paced_reading', [1200, 1400]), ...reading('normal_reading', [600])],
      600,
    )
    expect(summary.paced.map((point) => point.score)).toEqual([1200, 1400])
    expect(summary.normal.map((point) => point.score)).toEqual([600])
  })

  it('入会時の何倍かは倍速読書だけで測る', () => {
    const summary = summarizeReadingSpeed(
      [...reading('paced_reading', [1200]), ...reading('normal_reading', [3000])],
      400,
    )
    expect(summary.progress?.multiplier).toBe(3)
    expect(summary.progress?.reachedTarget).toBe(true)
  })

  it('Baseline がなければ倍率を出さない', () => {
    // 分母がないのに「何倍」と言わない。
    const summary = summarizeReadingSpeed(reading('paced_reading', [1200]), null)
    expect(summary.progress).toBeNull()
    expect(summary.latestPacedCpm).toBe(1200)
  })

  it('倍速読書の記録がなければ倍率を出さない', () => {
    const summary = summarizeReadingSpeed(reading('normal_reading', [600]), 400)
    expect(summary.progress).toBeNull()
    expect(summary.latestPacedCpm).toBeNull()
  })

  it('分速を持たない記録は点にしない', () => {
    // 弾かれた記録（valid=false）は Repository が返さないが、
    // 分速が入っていない記録が混ざっても 0 の点を作らないこと。
    const summary = summarizeReadingSpeed(
      [record({ exercise: 'paced_reading', score: 8, cpm: null })],
      400,
    )
    expect(summary.paced).toEqual([])
  })

  it('読書以外の種目は混ぜない', () => {
    const summary = summarizeReadingSpeed(series('logical_test', [20]), 400)
    expect(summary.paced).toEqual([])
    expect(summary.normal).toEqual([])
  })
})

describe('trainingStreak', () => {
  const on = (dates: readonly string[]): BtrRecordLike[] =>
    dates.map((date) => record({ exercise: 'saccade', score: 40, localDate: d(date) }))

  it('記録がなければ0', () => {
    expect(trainingStreak([], d('2026-08-22'))).toBe(0)
  })

  it('今日から続いた日数を数える', () => {
    expect(trainingStreak(on(['2026-08-20', '2026-08-21', '2026-08-22']), d('2026-08-22'))).toBe(3)
  })

  it('今日まだやっていなくても切らさない', () => {
    // 夜にやる人が朝に開いたとき、続いていたものが切れたように見えないこと。
    expect(trainingStreak(on(['2026-08-20', '2026-08-21']), d('2026-08-22'))).toBe(2)
  })

  it('2日空いたら切れる', () => {
    expect(trainingStreak(on(['2026-08-19', '2026-08-20']), d('2026-08-22'))).toBe(0)
  })

  it('同じ日に何度やっても1日と数える', () => {
    expect(trainingStreak(on(['2026-08-22', '2026-08-22', '2026-08-22']), d('2026-08-22'))).toBe(1)
  })

  it('古い連続は数えない', () => {
    // 間が空いていれば、そこで止める。
    expect(
      trainingStreak(on(['2026-08-01', '2026-08-02', '2026-08-21', '2026-08-22']), d('2026-08-22')),
    ).toBe(2)
  })

  it('月をまたいでも数えられる', () => {
    expect(trainingStreak(on(['2026-07-31', '2026-08-01']), d('2026-08-01'))).toBe(2)
  })
})

describe('latestSession', () => {
  it('記録がなければ null', () => {
    expect(latestSession([])).toBeNull()
  })

  it('いちばん新しい日の記録をまとめて返す', () => {
    const rows = [
      record({ exercise: 'saccade', score: 40, localDate: d('2026-08-21') }),
      record({ exercise: 'saccade', score: 44, localDate: d('2026-08-22') }),
      record({ exercise: 'logical_test', score: 22, localDate: d('2026-08-22') }),
    ]
    const session = latestSession(rows)
    expect(session?.date).toBe('2026-08-22')
    expect(session?.records).toHaveLength(2)
  })
})
