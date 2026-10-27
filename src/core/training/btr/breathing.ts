/**
 * カウント呼吸法（BTRメソッド 準備）
 *
 * **制限時間内に自分が何回呼吸したかを数える。**
 * 呼吸を指定の速さに合わせるのではなく、いまの自分の呼吸を測る。
 *
 * この種目だけ **少ないほうがよい**。
 * 呼吸が深くゆっくりになるほど回数は減る。他の種目と同じ「多いほど良い」で
 * 扱うと評価が逆になるので、スコアの向きを型で持たせている。
 */

export const BREATHING = {
  /** 測る長さ（ms）。1回90分の配分では3分だが、測定そのものは1分で足りる。 */
  durationMs: 60_000,
  /**
   * 落ち着いた状態の目安（1分あたりの回数）。
   * 成人の安静時は概ね 12〜20 回。これを下回れば十分に整っているとみなす。
   */
  calmBreaths: 12,
  /** これを超えていたら、始める前にもう少し落ち着いたほうがよい。 */
  restlessBreaths: 20,
} as const

export type BreathingState = 'calm' | 'normal' | 'restless'

export interface BreathingResult {
  /** 数えた呼吸の回数。これが記録するスコア。 */
  readonly breaths: number
  /** 実際に測った長さ（ms） */
  readonly elapsedMs: number
  /** 1分あたりに直した回数 */
  readonly perMinute: number
  readonly state: BreathingState
  /**
   * この種目は少ないほうがよい。
   * 推移グラフや「伸びたか」の判定で向きを間違えないための印。
   */
  readonly lowerIsBetter: true
}

export function scoreBreathing(breaths: number, elapsedMs: number): BreathingResult {
  const safeBreaths = Math.max(0, breaths)
  const perMinute =
    elapsedMs <= 0 ? 0 : Math.round((safeBreaths / (elapsedMs / 60_000)) * 10) / 10

  const state: BreathingState =
    perMinute === 0
      ? 'normal'
      : perMinute <= BREATHING.calmBreaths
        ? 'calm'
        : perMinute >= BREATHING.restlessBreaths
          ? 'restless'
          : 'normal'

  return { breaths: safeBreaths, elapsedMs, perMinute, state, lowerIsBetter: true }
}

export const BREATHING_STATE_MESSAGES: Record<BreathingState, string> = {
  calm: '呼吸が深く整っています。このまま始めてください。',
  normal: '落ち着いています。始めましょう。',
  restless: '呼吸が速めです。もう少し息を長く吐いてから始めると集中が続きます。',
}
