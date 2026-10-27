'use client'

import { useEffect, useState } from 'react'
import {
  BREATHING,
  BREATHING_STATE_MESSAGES,
  scoreBreathing,
} from '@/core/training/btr/breathing'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * カウント呼吸法（BTRメソッド 準備）
 *
 * 決まった時間のあいだ、自分が何回呼吸したかを数える。
 * 呼吸を指定の速さに合わせるのではなく、いまの自分の呼吸を測る。
 *
 * **この種目だけ少ないほうがよい。** 画面でもそう伝える。
 * 「多いほど良い」と受け取られると、速く呼吸して数字を上げる人が出る。
 */

export type BreathingBlockProps = BtrBlockProps

type Phase = 'intro' | 'running' | 'result'

export function BreathingBlock({ onComplete }: BreathingBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [breaths, setBreaths] = useState(0)
  const [pulse, setPulse] = useState(false)

  const countdown = useCountdown({
    durationMs: BREATHING.durationMs,
    onFinish: () => setPhase('result'),
  })

  const { start } = countdown
  const running = phase === 'running'
  useEffect(() => {
    if (running) start()
  }, [running, start])

  const count = () => {
    if (!countdown.running) return
    setBreaths((current) => current + 1)
    setPulse(true)
    window.setTimeout(() => setPulse(false), 160)
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="準備"
        title="カウント呼吸法"
        startLabel="数えはじめる"
        onStart={() => {
          setBreaths(0)
          setPhase('running')
        }}
      >
        <p>
          {Math.round(BREATHING.durationMs / 1000)} 秒のあいだ、
          <strong className="text-fg">息を吐ききるたびに画面を押してください。</strong>
          呼吸を速めたり遅めたりせず、いつもどおりに。
        </p>
        <p>
          この項目は<strong className="text-fg">少ないほうがよい</strong>数字です。
          落ち着いて深く呼吸できているほど回数は減ります。
        </p>
      </BtrIntro>
    )
  }

  if (phase === 'running') {
    return (
      <>
        <BtrTimerBar
          remainingMs={countdown.remainingMs}
          progress={countdown.progress}
          detail={`${breaths} 回`}
        />
        <main className="flex min-h-dvh flex-col px-5 pt-14 pb-6 sm:px-8">
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault()
              count()
            }}
            className="flex flex-1 flex-col items-center justify-center gap-6 rounded-2xl border border-border bg-surface transition-colors select-none active:bg-surface-muted"
          >
            <span
              aria-hidden
              className={
                pulse
                  ? 'block size-32 rounded-full bg-brand transition-transform duration-150 scale-110'
                  : 'block size-32 rounded-full bg-surface-muted transition-transform duration-300'
              }
            />
            <span className="tabular text-4xl font-semibold">{breaths}</span>
            <span className="text-sm text-fg-muted">息を吐ききるたびに押す</span>
          </button>
        </main>
      </>
    )
  }

  const result = scoreBreathing(breaths, BREATHING.durationMs)
  return (
    <BtrResult
      title="カウント呼吸法"
      score={result.breaths}
      scoreUnit={`回 / ${Math.round(BREATHING.durationMs / 1000)}秒`}
      lines={[{ label: '1分あたり', value: `${result.perMinute} 回` }]}
      note={BREATHING_STATE_MESSAGES[result.state]}
      nextLabel="トレーニングへ"
      onNext={() =>
        onComplete({
          score: result.breaths,
          elapsedMs: result.elapsedMs,
          timeLimitMs: BREATHING.durationMs,
          // この種目だけ少ないほうがよい。記録に残さないと推移の向きを決められない。
          lowerIsBetter: true,
        })
      }
    />
  )
}
