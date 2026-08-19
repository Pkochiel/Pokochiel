import { SPEED_ADAPTATION } from '../config/training-config'

export interface AdaptSpeedInput {
  currentTargetCpm: number
  baselineCpm: number
  /** 直近の理解度（0–100）。古い順。 */
  recentComprehension: readonly number[]
  /** 直近の回で出題された設問数。少なすぎる回では速度を動かさない。 */
  questionCount: number
}

export type SpeedDirection = 'up' | 'hold' | 'down'

export interface AdaptSpeedResult {
  targetCpm: number
  direction: SpeedDirection
  /** なぜその判断になったか。AI Coach の説明文の材料にする。 */
  reason: string
}

function clampToBaseline(cpm: number, baselineCpm: number): number {
  const min = baselineCpm * SPEED_ADAPTATION.minMultiplierOfBaseline
  const max = baselineCpm * SPEED_ADAPTATION.maxMultiplierOfBaseline
  return Math.round(Math.min(max, Math.max(min, cpm)))
}

/**
 * 理解度に応じて目標速度を調整する。
 *
 *   comprehension >= 85%  → +5%
 *   70–84%                → 維持
 *   < 70%                 → -5%
 *
 * 1回の結果で乱高下させないため直近数件の平均で判断し、
 * 設問が少なすぎる回では動かさない。上下は baseline の 0.8〜2.5 倍に収める。
 * 極端な速度を追求しない、という方針をここで担保する。
 */
export function adaptSpeed(input: AdaptSpeedInput): AdaptSpeedResult {
  const { currentTargetCpm, baselineCpm, recentComprehension, questionCount } = input
  const clamped = clampToBaseline(currentTargetCpm, baselineCpm)

  if (questionCount < SPEED_ADAPTATION.minQuestionsForAdaptation) {
    return {
      targetCpm: clamped,
      direction: 'hold',
      reason: '設問数が少なく、理解度の判定に足りないため速度を変更しません',
    }
  }

  const samples = recentComprehension.slice(-SPEED_ADAPTATION.recentWindow)
  if (samples.length === 0) {
    return {
      targetCpm: clamped,
      direction: 'hold',
      reason: '理解度の実績がないため速度を変更しません',
    }
  }

  const meanRatio = samples.reduce((sum, v) => sum + v, 0) / samples.length / 100

  if (meanRatio >= SPEED_ADAPTATION.highComprehension) {
    const next = clampToBaseline(clamped * (1 + SPEED_ADAPTATION.increaseRate), baselineCpm)
    return {
      targetCpm: next,
      direction: next > clamped ? 'up' : 'hold',
      reason:
        next > clamped
          ? '理解度が保てているため速度を上げます'
          : '理解度は高いものの、上限に達しているため速度を維持します',
    }
  }

  if (meanRatio < SPEED_ADAPTATION.lowComprehension) {
    const next = clampToBaseline(clamped * (1 - SPEED_ADAPTATION.decreaseRate), baselineCpm)
    return {
      targetCpm: next,
      direction: next < clamped ? 'down' : 'hold',
      reason:
        next < clamped
          ? '理解度が下がっているため速度を戻します'
          : '理解度は低いものの、下限に達しているため速度を維持します',
    }
  }

  return { targetCpm: clamped, direction: 'hold', reason: '理解度は適正な範囲です' }
}
