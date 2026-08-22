import { describe, expect, it } from 'vitest'
import {
  PACED_READING,
  READING_MODE_LABELS,
  isValidCharsPerPage,
  measureProgress,
  scorePacedReading,
} from './paced-reading'

describe('isValidCharsPerPage', () => {
  it('文庫や単行本の範囲を受け付ける', () => {
    expect(isValidCharsPerPage(600)).toBe(true)
    expect(isValidCharsPerPage(900)).toBe(true)
  })

  it('桁を間違えた入力を弾く', () => {
    expect(isValidCharsPerPage(6)).toBe(false)
    expect(isValidCharsPerPage(60_000)).toBe(false)
  })

  it('数でない値を弾く', () => {
    expect(isValidCharsPerPage(Number.NaN)).toBe(false)
    expect(isValidCharsPerPage(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('scorePacedReading', () => {
  it('ページ数と1ページの文字数から字数を出す', () => {
    expect(scorePacedReading({ mode: 'paced', charsPerPage: 600, pages: 20, elapsedMs: 600_000 }).characters).toBe(
      12_000,
    )
  })

  it('1分あたりの文字数を出す', () => {
    // 20ページ × 600字 ＝ 12,000字を10分 → 1,200 字/分
    expect(scorePacedReading({ mode: 'paced', charsPerPage: 600, pages: 20, elapsedMs: 600_000 }).cpm).toBe(1200)
  })

  it('1分あたりのページ数も出す', () => {
    expect(
      scorePacedReading({ mode: 'paced', charsPerPage: 600, pages: 20, elapsedMs: 600_000 }).pagesPerMinute,
    ).toBe(2)
  })

  it('時間が 0 なら速度を 0 にする', () => {
    const result = scorePacedReading({ mode: 'paced', charsPerPage: 600, pages: 20, elapsedMs: 0 })
    expect(result.cpm).toBe(0)
    expect(result.valid).toBe(false)
  })

  it('ページ数が 0 なら記録として認めない', () => {
    expect(scorePacedReading({ mode: 'paced', charsPerPage: 600, pages: 0, elapsedMs: 600_000 }).valid).toBe(false)
  })

  it('1ページの文字数が桁違いなら記録として認めない', () => {
    expect(scorePacedReading({ mode: 'paced', charsPerPage: 6, pages: 20, elapsedMs: 600_000 }).valid).toBe(false)
  })

  it('妥当な入力なら valid になる', () => {
    expect(scorePacedReading({ mode: 'paced', charsPerPage: 600, pages: 20, elapsedMs: 600_000 }).valid).toBe(true)
  })
})

describe('読み方の区別', () => {
  it('普通読書と倍速読書を分けて記録する', () => {
    // ひとつにまとめると、速く読もうとした日の数字とふだんの数字が混ざる。
    const normal = scorePacedReading({
      mode: 'normal',
      charsPerPage: 600,
      pages: 10,
      elapsedMs: 600_000,
    })
    const paced = scorePacedReading({
      mode: 'paced',
      charsPerPage: 600,
      pages: 20,
      elapsedMs: 600_000,
    })
    expect(normal.mode).toBe('normal')
    expect(paced.mode).toBe('paced')
    expect(paced.cpm).toBeGreaterThan(normal.cpm)
  })

  it('表示名を持つ', () => {
    expect(READING_MODE_LABELS.normal).toBe('普通読書')
    expect(READING_MODE_LABELS.paced).toBe('倍速読書')
  })
})

describe('measureProgress', () => {
  it('入会時の何倍かを出す', () => {
    expect(measureProgress(400, 1200).multiplier).toBe(3)
  })

  it('3倍に届いたら到達とみなす', () => {
    // スクールの方針が「実用的な3倍」なので、そこを目標に置いている。
    expect(measureProgress(400, 1200).reachedTarget).toBe(true)
  })

  it('わずかに足りないのを丸めて到達にしない', () => {
    // 1199 / 400 = 2.9975。表示のために丸めた値で判定すると 3.00 倍に見えてしまう。
    const result = measureProgress(400, 1199)
    expect(result.reachedTarget).toBe(false)
    expect(result.multiplier).toBe(3)
  })

  it('目標への到達率を出す', () => {
    expect(measureProgress(400, 600).towardTarget).toBe(50)
  })

  it('到達率は 100 を超えない', () => {
    expect(measureProgress(400, 4000).towardTarget).toBe(100)
  })

  it('遅くなっても負にならない', () => {
    const result = measureProgress(400, 200)
    expect(result.multiplier).toBe(0.5)
    expect(result.towardTarget).toBeGreaterThanOrEqual(0)
  })

  it('Baseline がなければ倍率を出さない', () => {
    // 分母がないのに「何倍」と言わない。
    const result = measureProgress(0, 1200)
    expect(result.multiplier).toBe(0)
    expect(result.reachedTarget).toBe(false)
  })

  it('目標は3倍', () => {
    expect(PACED_READING.targetMultiplier).toBe(3)
  })
})
