'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { calculateCpm } from '@/core/metrics/cpm'
import { PacedText } from '../shared/paced-text'
import { TrainingHud } from '../shared/training-hud'
import { usePacer } from '../shared/use-pacer'
import type { TrainingBlockProps } from '../shared/types'

/** ウォームアップはやや遅めから入る。いきなり目標速度で始めない。 */
const WARMUP_SPEED_RATIO = 0.85

/**
 * Training 00: Warm-up
 *
 * 設問を伴わない短い通読。読む姿勢に切り替えることが目的なので、
 * 速度は目標よりやや遅くし、理解度も測らない。
 */
export function WarmupBlock({ passage, targetCpm, onComplete }: TrainingBlockProps) {
  const [started, setStarted] = useState(false)
  const warmupCpm = Math.round(targetCpm * WARMUP_SPEED_RATIO)

  const finish = useCallback(
    (result: { elapsedSeconds: number; pauseCount: number }) => {
      const { cpm, valid } = calculateCpm({
        characterCount: passage.characterCount,
        elapsedSeconds: result.elapsedSeconds,
      })
      onComplete({
        cpm,
        targetCpm: warmupCpm,
        valid,
        pauseCount: result.pauseCount,
      })
    },
    [onComplete, passage.characterCount, warmupCpm],
  )

  const pacer = usePacer({
    targetCpm: warmupCpm,
    totalCharacters: passage.characterCount,
    onReachEnd: finish,
  })

  if (!started) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Warm-up</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">読む姿勢をつくる</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          設問はありません。{warmupCpm} 字/分のハイライトに沿って、力まずに読んでください。
        </p>
        <Button
          size="lg"
          className="mt-8 w-full sm:w-auto"
          onClick={() => {
            pacer.start()
            setStarted(true)
          }}
        >
          Start
        </Button>
      </main>
    )
  }

  return (
    <>
      <TrainingHud
        title="Warm-up"
        elapsedSeconds={pacer.elapsedSeconds}
        cpm={warmupCpm}
        progress={pacer.progress}
      />
      <main className="mx-auto max-w-3xl px-5 pt-24 pb-32 sm:px-8">
        <PacedText chunks={passage.chunks} position={pacer.position} />
      </main>
      <div className="fixed inset-x-0 bottom-0 bg-reading-bg/90 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-3xl justify-end">
          <Button onClick={() => finish(pacer.finish())}>読み終えた</Button>
        </div>
      </div>
    </>
  )
}
