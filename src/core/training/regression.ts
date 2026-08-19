import { REGRESSION } from '../config/training-config'

/**
 * Regression Control の評価。
 *
 * 鍛えるのは「無意識の不要な読み戻りを減らすこと」であって、
 * 読み戻しの禁止ではない。したがって回数の少なさだけでは良し悪しを判断せず、
 * 必ず理解度と対にして評価する。
 */
export type RegressionVerdict =
  | 'improved'
  | 'maintained'
  | 'too_fast'
  | 'needs_more_control'
  | 'insufficient_data'

export interface RegressionInput {
  backCount: number
  pauseCount: number
  characterCount: number
  comprehensionScore: number | null
  /** 前回の読み戻り密度（1000字あたり）。初回は null */
  previousBackPerKiloChars: number | null
  /** 前回の理解度。初回は null */
  previousComprehension: number | null
}

export interface RegressionEvaluation {
  backPerKiloChars: number
  verdict: RegressionVerdict
  message: string
}

const MESSAGES: Record<RegressionVerdict, string> = {
  improved: '読み戻りが減り、理解度も保てています。無駄な戻りが減っている状態です。',
  maintained: '読み戻りと理解度のバランスは保てています。',
  too_fast:
    '読み戻りは減りましたが、理解度が大きく落ちています。戻らなかったのではなく、取りこぼしたまま進んでいる可能性があります。',
  needs_more_control:
    '読み戻りが多めです。分からないまま進む必要はありませんが、戻る前に一度先まで読み切ると減ることがあります。',
  insufficient_data: '比較できる前回の記録がないため、今回の値を基準として記録します。',
}

export function backPerKiloChars(backCount: number, characterCount: number): number {
  if (characterCount <= 0) return 0
  return Math.round((backCount / characterCount) * 1000 * 10) / 10
}

export function evaluateRegression(input: RegressionInput): RegressionEvaluation {
  const density = backPerKiloChars(input.backCount, input.characterCount)

  if (input.previousBackPerKiloChars === null || input.previousComprehension === null) {
    return {
      backPerKiloChars: density,
      verdict: 'insufficient_data',
      message: MESSAGES.insufficient_data,
    }
  }

  const decreased = density < input.previousBackPerKiloChars
  const comprehensionDrop =
    input.comprehensionScore === null
      ? 0
      : input.previousComprehension - input.comprehensionScore

  if (decreased && comprehensionDrop >= REGRESSION.comprehensionDropThreshold) {
    return { backPerKiloChars: density, verdict: 'too_fast', message: MESSAGES.too_fast }
  }
  if (decreased) {
    return { backPerKiloChars: density, verdict: 'improved', message: MESSAGES.improved }
  }
  if (density > REGRESSION.highBackPerKiloChars) {
    return {
      backPerKiloChars: density,
      verdict: 'needs_more_control',
      message: MESSAGES.needs_more_control,
    }
  }
  return { backPerKiloChars: density, verdict: 'maintained', message: MESSAGES.maintained }
}
