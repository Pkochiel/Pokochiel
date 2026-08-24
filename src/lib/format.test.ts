import { describe, expect, it } from 'vitest'
import { formatDuration, formatInteger, formatScore } from './format'

describe('formatDuration', () => {
  it('mm:ss で表示する', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(9)).toBe('00:09')
    expect(formatDuration(154)).toBe('02:34')
    expect(formatDuration(600)).toBe('10:00')
  })

  it('小数を切り捨てる', () => {
    expect(formatDuration(59.9)).toBe('00:59')
  })

  it('負の値を 00:00 にする', () => {
    expect(formatDuration(-5)).toBe('00:00')
  })
})

describe('formatInteger', () => {
  it('桁区切りを入れる', () => {
    expect(formatInteger(1350)).toBe('1,350')
  })
})

describe('formatScore', () => {
  it('欠損を 0 と区別して表示する', () => {
    expect(formatScore(null)).toBe('—')
    expect(formatScore(0)).toBe('0')
    expect(formatScore(80, '%')).toBe('80%')
  })
})
