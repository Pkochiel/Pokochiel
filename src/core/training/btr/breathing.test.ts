import { describe, expect, it } from 'vitest'
import { BREATHING, scoreBreathing } from './breathing'

describe('scoreBreathing', () => {
  it('数えた回数をそのまま記録する', () => {
    expect(scoreBreathing(14, 60_000).breaths).toBe(14)
  })

  it('1分あたりに直す', () => {
    // 30秒で7回なら、1分あたり14回。
    expect(scoreBreathing(7, 30_000).perMinute).toBe(14)
  })

  it('この種目は少ないほうがよい', () => {
    // 他の種目と同じ「多いほど良い」で扱うと評価が逆になる。
    expect(scoreBreathing(10, 60_000).lowerIsBetter).toBe(true)
  })

  it('少なければ整っていると見る', () => {
    expect(scoreBreathing(BREATHING.calmBreaths, 60_000).state).toBe('calm')
    expect(scoreBreathing(8, 60_000).state).toBe('calm')
  })

  it('多ければ落ち着いていないと見る', () => {
    expect(scoreBreathing(BREATHING.restlessBreaths, 60_000).state).toBe('restless')
    expect(scoreBreathing(28, 60_000).state).toBe('restless')
  })

  it('あいだは normal', () => {
    expect(scoreBreathing(16, 60_000).state).toBe('normal')
  })

  it('負の回数は 0 にする', () => {
    expect(scoreBreathing(-5, 60_000).breaths).toBe(0)
  })

  it('時間が 0 なら割らずに 0 を返す', () => {
    const result = scoreBreathing(10, 0)
    expect(result.perMinute).toBe(0)
    expect(result.state).toBe('normal')
  })

  it('一度も数えなければ判定しない', () => {
    // 押し忘れを「呼吸0回の達人」と扱わない。
    expect(scoreBreathing(0, 60_000).state).toBe('normal')
  })
})

describe('BREATHING の設定', () => {
  it('落ち着きの目安が安静時の範囲に入っている', () => {
    // 成人の安静時は概ね 12〜20 回。
    expect(BREATHING.calmBreaths).toBeLessThan(BREATHING.restlessBreaths)
    expect(BREATHING.calmBreaths).toBeGreaterThanOrEqual(8)
    expect(BREATHING.restlessBreaths).toBeLessThanOrEqual(25)
  })
})
