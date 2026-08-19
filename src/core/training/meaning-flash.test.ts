import { describe, expect, it } from 'vitest'
import { MEANING_FLASH } from '../config/training-config'
import { adaptMeaningFlashLevel, exposureMsFor, scoreMeaningFlash } from './meaning-flash'

describe('exposureMsFor', () => {
  it('レベルが上がるほど表示時間が短くなる', () => {
    expect(exposureMsFor(1)).toBeGreaterThan(exposureMsFor(3))
    expect(exposureMsFor(3)).toBeGreaterThan(exposureMsFor(5))
  })

  it('安全下限を下回らない（極端なフラッシュ表示にしない）', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(exposureMsFor(level)).toBeGreaterThanOrEqual(MEANING_FLASH.minExposureMs)
    }
  })

  it('仕様どおりの時間帯に収まる', () => {
    // Level 1 は 2〜3秒、Level 3 は 1秒前後
    expect(exposureMsFor(1)).toBeGreaterThanOrEqual(2000)
    expect(exposureMsFor(3)).toBeLessThanOrEqual(1500)
  })
})

describe('scoreMeaningFlash', () => {
  it('正答率を 0–100 で返す', () => {
    expect(scoreMeaningFlash([true, true, true, true]).score).toBe(100)
    expect(scoreMeaningFlash([true, false, true, false]).score).toBe(50)
    expect(scoreMeaningFlash([false, false]).score).toBe(0)
  })

  it('件数と正答数を返す', () => {
    const result = scoreMeaningFlash([true, false, true])
    expect(result.correct).toBe(2)
    expect(result.total).toBe(3)
    expect(result.score).toBe(67)
  })

  it('回答がなくても落ちない', () => {
    expect(scoreMeaningFlash([]).score).toBe(0)
  })
})

describe('adaptMeaningFlashLevel', () => {
  it('正答率が高ければレベルを上げる（表示時間を短くする）', () => {
    expect(adaptMeaningFlashLevel(2, 0.9)).toBe(3)
  })

  it('正答率が低ければレベルを下げる', () => {
    expect(adaptMeaningFlashLevel(3, 0.4)).toBe(2)
  })

  it('中間なら維持する', () => {
    expect(adaptMeaningFlashLevel(3, 0.7)).toBe(3)
  })

  it('範囲を超えない', () => {
    expect(adaptMeaningFlashLevel(5, 1)).toBe(5)
    expect(adaptMeaningFlashLevel(1, 0)).toBe(1)
  })

  it('閾値ちょうどの扱いが設定と一致する', () => {
    expect(adaptMeaningFlashLevel(2, MEANING_FLASH.levelUpAccuracy)).toBe(3)
    expect(adaptMeaningFlashLevel(2, MEANING_FLASH.levelDownAccuracy)).toBe(2)
  })

  it('連続して正解しても上限で止まる', () => {
    let level = 1 as 1 | 2 | 3 | 4 | 5
    for (let i = 0; i < 10; i += 1) level = adaptMeaningFlashLevel(level, 1)
    expect(level).toBe(5)
  })
})
