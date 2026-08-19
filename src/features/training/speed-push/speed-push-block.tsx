'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { calculateCpm } from '@/core/metrics/cpm'
import { scoreComprehension } from '@/core/metrics/comprehension'
import { TrainingHud } from '../shared/training-hud'
import { PacedText } from '../shared/paced-text'
import { QuestionRunner } from '../shared/question-runner'
import { usePacer } from '../shared/use-pacer'
import type { TrainingBlockProps } from '../shared/types'

/** Speed Push の理解度チェックは短く済ませる。速度適応はセッション全体の実績で行う。 */
const QUICK_CHECK_QUESTIONS = 3

type Phase = 'intro' | 'reading' | 'questions'

/**
 * Training 01: Speed Push
 *
 * 普段より少し速い速度で読む経験を作る。
 * ペーサーは目標速度で進むが、読み終えるまでの実測から CPM を出すため、
 * ペーサーに追いつけなくても記録は実際の読書速度になる。
 */
export function SpeedPushBlock({ passage, targetCpm, minutes, onComplete }: TrainingBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [measurement, setMeasurement] = useState<{
    elapsedSeconds: number
    pauseCount: number
  } | null>(null)

  const questions = passage.questions.slice(0, QUICK_CHECK_QUESTIONS)

  const handleReachEnd = useCallback(
    (result: { elapsedSeconds: number; pauseCount: number }) => {
      setMeasurement(result)
      setPhase('questions')
    },
    [],
  )

  // ペーサーが本文を読み切ったら自動で設問へ進む
  const pacer = usePacer({
    targetCpm,
    totalCharacters: passage.characterCount,
    onReachEnd: handleReachEnd,
  })

  const finishReading = () => {
    setMeasurement(pacer.finish())
    setPhase('questions')
  }

  // Space で一時停止／再開
  useEffect(() => {
    if (phase !== 'reading') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      event.preventDefault()
      pacer.toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, pacer])

  if (phase === 'intro') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Speed Push</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{passage.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          ハイライトが <span className="tabular font-medium text-fg">{targetCpm} 字/分</span>{' '}
          で進みます。無理に合わせず、理解できる範囲で追いかけてください。目安 {minutes} 分。
        </p>
        <p className="mt-2 text-xs text-fg-subtle">Space キーで一時停止できます。</p>
        <Button
          size="lg"
          className="mt-8 w-full sm:w-auto"
          onClick={() => {
            pacer.start()
            setPhase('reading')
          }}
        >
          Start
        </Button>
      </Centered>
    )
  }

  if (phase === 'reading') {
    return (
      <>
        <TrainingHud
          title="Speed Push"
          elapsedSeconds={pacer.elapsedSeconds}
          cpm={targetCpm}
          progress={pacer.progress}
        />
        <main className="mx-auto max-w-3xl px-5 pt-24 pb-32 sm:px-8">
          <PacedText chunks={passage.chunks} position={pacer.position} />
        </main>
        <div className="fixed inset-x-0 bottom-0 bg-reading-bg/90 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <Button variant="ghost" onClick={pacer.toggle}>
              {pacer.status === 'paused' ? '再開' : '一時停止'}
            </Button>
            <Button onClick={finishReading}>読み終えた</Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <Centered>
      <QuestionRunner
        questions={questions}
        title="理解度チェック"
        onComplete={(answers) => {
          const comprehension = scoreComprehension(questions, answers)
          const { cpm, valid } = calculateCpm({
            characterCount: passage.characterCount,
            elapsedSeconds: measurement?.elapsedSeconds ?? 0,
          })
          onComplete({
            cpm,
            targetCpm,
            valid,
            comprehensionScore: comprehension.score,
            questionCount: comprehension.total,
            pauseCount: measurement?.pauseCount ?? 0,
          })
        }}
      />
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      {children}
    </main>
  )
}
