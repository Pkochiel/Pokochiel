import { describe, expect, it } from 'vitest'
import { SPEED_ADAPTATION } from '../config/training-config'
import { adaptSpeed } from './speed'

const base = {
  currentTargetCpm: 700,
  baselineCpm: 600,
  questionCount: 5,
}

describe('adaptSpeed', () => {
  it('理解度 85% 以上で速度を上げる', () => {
    const result = adaptSpeed({ ...base, recentComprehension: [90, 90] })
    expect(result.direction).toBe('up')
    expect(result.targetCpm).toBe(735)
  })

  it('閾値ちょうど（85%）でも上げる', () => {
    expect(adaptSpeed({ ...base, recentComprehension: [85] }).direction).toBe('up')
  })

  it('70〜84% では維持する', () => {
    for (const value of [70, 75, 84]) {
      const result = adaptSpeed({ ...base, recentComprehension: [value] })
      expect(result.direction).toBe('hold')
      expect(result.targetCpm).toBe(700)
    }
  })

  it('70% 未満で速度を下げる', () => {
    const result = adaptSpeed({ ...base, recentComprehension: [60] })
    expect(result.direction).toBe('down')
    expect(result.targetCpm).toBe(665)
  })

  it('1回の結果で乱高下させず、直近の平均で判断する', () => {
    // 直近1件だけなら 60% で低下と判定されるが、平均 73% なので維持する
    const result = adaptSpeed({ ...base, recentComprehension: [100, 60, 60] })
    expect(adaptSpeed({ ...base, recentComprehension: [60] }).direction).toBe('down')
    expect(result.direction).toBe('hold')
  })

  it('直近 N 件だけを見る', () => {
    const many = [0, 0, 0, 90, 90, 90, 90, 90]
    expect(adaptSpeed({ ...base, recentComprehension: many }).direction).toBe('up')
  })

  it('設問が少なすぎる回では速度を変更しない', () => {
    const result = adaptSpeed({
      ...base,
      questionCount: SPEED_ADAPTATION.minQuestionsForAdaptation - 1,
      recentComprehension: [100],
    })
    expect(result.direction).toBe('hold')
    expect(result.reason).toContain('設問数')
  })

  it('理解度の実績がなければ変更しない', () => {
    expect(adaptSpeed({ ...base, recentComprehension: [] }).direction).toBe('hold')
  })

  it('baseline の 2.5 倍を超えない（極端な速度を追求しない）', () => {
    const result = adaptSpeed({
      currentTargetCpm: 1500,
      baselineCpm: 600,
      questionCount: 5,
      recentComprehension: [100, 100, 100],
    })
    expect(result.targetCpm).toBe(1500)
    expect(result.direction).toBe('hold')
    expect(result.reason).toContain('上限')
  })

  it('baseline の 0.8 倍を下回らない', () => {
    const result = adaptSpeed({
      currentTargetCpm: 480,
      baselineCpm: 600,
      questionCount: 5,
      recentComprehension: [10],
    })
    expect(result.targetCpm).toBe(480)
    expect(result.direction).toBe('hold')
    expect(result.reason).toContain('下限')
  })

  it('範囲外の現在値は範囲内に丸めてから判断する', () => {
    const result = adaptSpeed({
      currentTargetCpm: 5000,
      baselineCpm: 600,
      questionCount: 5,
      recentComprehension: [75],
    })
    expect(result.targetCpm).toBe(1500)
  })

  it('上げ続けても際限なく速くならない', () => {
    let target = 690
    for (let i = 0; i < 50; i += 1) {
      target = adaptSpeed({
        currentTargetCpm: target,
        baselineCpm: 600,
        questionCount: 5,
        recentComprehension: [100],
      }).targetCpm
    }
    expect(target).toBeLessThanOrEqual(600 * SPEED_ADAPTATION.maxMultiplierOfBaseline)
  })

  it('判断理由を返す', () => {
    expect(adaptSpeed({ ...base, recentComprehension: [90] }).reason).toBeTruthy()
  })
})
