import { describe, expect, it } from 'vitest'
import { toLocalDate } from '../types/common'
import {
  addDays,
  calculateStreak,
  compareLocalDate,
  diffDays,
  formatLocalDate,
  isSameOrBefore,
  parseLocalDate,
} from './date'

const d = (value: string) => toLocalDate(value)

describe('formatLocalDate', () => {
  it('タイムゾーンにおける暦日を返す', () => {
    // 2026-08-19T14:30Z は東京では 2026-08-19 23:30
    const date = new Date('2026-08-19T14:30:00Z')
    expect(formatLocalDate(date, 'Asia/Tokyo')).toBe('2026-08-19')
  })

  it('深夜のトレーニングを翌日扱いにしない', () => {
    // 2026-08-19T16:00Z は東京では 2026-08-20 01:00（UTC 日付とずれる）
    const date = new Date('2026-08-19T16:00:00Z')
    expect(formatLocalDate(date, 'Asia/Tokyo')).toBe('2026-08-20')
    expect(formatLocalDate(date, 'UTC')).toBe('2026-08-19')
  })

  it('タイムゾーンによって日付が変わる', () => {
    const date = new Date('2026-08-19T02:00:00Z')
    expect(formatLocalDate(date, 'Asia/Tokyo')).toBe('2026-08-19')
    expect(formatLocalDate(date, 'America/Los_Angeles')).toBe('2026-08-18')
  })
})

describe('parseLocalDate', () => {
  it('年月日に分解する', () => {
    expect(parseLocalDate(d('2026-08-19'))).toEqual({ year: 2026, month: 8, day: 19 })
  })

  it('不正な値を弾く', () => {
    expect(() => parseLocalDate(d('not-a-date'))).toThrow()
  })
})

describe('addDays', () => {
  it('翌日を返す', () => {
    expect(addDays(d('2026-08-19'), 1)).toBe('2026-08-20')
  })

  it('月をまたぐ', () => {
    expect(addDays(d('2026-08-31'), 1)).toBe('2026-09-01')
  })

  it('年をまたぐ', () => {
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01')
  })

  it('うるう年を扱える', () => {
    expect(addDays(d('2028-02-28'), 1)).toBe('2028-02-29')
    expect(addDays(d('2027-02-28'), 1)).toBe('2027-03-01')
  })

  it('負の日数で遡れる', () => {
    expect(addDays(d('2026-03-01'), -1)).toBe('2026-02-28')
  })

  it('夏時間の切り替え日でも1日ずれない', () => {
    // 米国の夏時間開始日をまたぐ（UTC 固定で計算しているため影響を受けない）
    expect(addDays(d('2026-03-08'), 1)).toBe('2026-03-09')
    expect(addDays(d('2026-11-01'), 1)).toBe('2026-11-02')
  })
})

describe('diffDays', () => {
  it('日数の差を返す', () => {
    expect(diffDays(d('2026-08-20'), d('2026-08-19'))).toBe(1)
    expect(diffDays(d('2026-08-19'), d('2026-08-20'))).toBe(-1)
    expect(diffDays(d('2026-08-19'), d('2026-08-19'))).toBe(0)
  })

  it('月をまたいでも正しい', () => {
    expect(diffDays(d('2026-09-01'), d('2026-08-30'))).toBe(2)
  })
})

describe('compareLocalDate / isSameOrBefore', () => {
  it('順序を比較できる', () => {
    expect(compareLocalDate(d('2026-08-19'), d('2026-08-20'))).toBeLessThan(0)
    expect(compareLocalDate(d('2026-08-20'), d('2026-08-19'))).toBeGreaterThan(0)
    expect(compareLocalDate(d('2026-08-19'), d('2026-08-19'))).toBe(0)
  })

  it('同日または以前を判定できる', () => {
    expect(isSameOrBefore(d('2026-08-19'), d('2026-08-19'))).toBe(true)
    expect(isSameOrBefore(d('2026-08-18'), d('2026-08-19'))).toBe(true)
    expect(isSameOrBefore(d('2026-08-20'), d('2026-08-19'))).toBe(false)
  })
})

describe('calculateStreak', () => {
  const today = d('2026-08-19')

  it('実施がなければ 0', () => {
    expect(calculateStreak([], today)).toBe(0)
  })

  it('今日実施していれば 1 から数える', () => {
    expect(calculateStreak([d('2026-08-19')], today)).toBe(1)
  })

  it('連続した日数を数える', () => {
    expect(
      calculateStreak([d('2026-08-17'), d('2026-08-18'), d('2026-08-19')], today),
    ).toBe(3)
  })

  it('同じ日に複数回実施しても 1 日と数える', () => {
    expect(
      calculateStreak([d('2026-08-19'), d('2026-08-19'), d('2026-08-18')], today),
    ).toBe(2)
  })

  it('途切れたらそこで止まる', () => {
    expect(
      calculateStreak([d('2026-08-15'), d('2026-08-18'), d('2026-08-19')], today),
    ).toBe(2)
  })

  it('今日まだ実施していなくても、昨日まで続いていれば維持される', () => {
    expect(calculateStreak([d('2026-08-17'), d('2026-08-18')], today)).toBe(2)
  })

  it('2 日以上空いていれば 0 になる', () => {
    expect(calculateStreak([d('2026-08-16'), d('2026-08-17')], today)).toBe(0)
  })

  it('順序が乱れた入力でも正しく数える', () => {
    expect(
      calculateStreak([d('2026-08-19'), d('2026-08-17'), d('2026-08-18')], today),
    ).toBe(3)
  })
})
