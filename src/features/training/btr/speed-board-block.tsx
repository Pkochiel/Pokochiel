'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BOARD_DIRECTION_LABELS,
  SPEED_BOARD,
  buildSpeedBoardQuestions,
  centerIndex,
  scoreSpeedBoard,
} from '@/core/training/btr/speed-board'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * スピードボード（BTRメソッド 読書内容への集中）
 *
 * 5×5 の盤。真ん中の点から「右に2、上に1」のように動いた先を指す。
 * 盤の上で指を滑らせて数えるのではなく、頭の中で位置を動かすのが要点なので、
 * 動いた跡は表示しない。真ん中の印だけを出す。
 */

export type SpeedBoardBlockProps = BtrBlockProps

type Phase = 'intro' | 'running' | 'result'

export function SpeedBoardBlock({ seed, level = 0, onComplete }: SpeedBoardBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<{ picked: number; correct: boolean } | null>(null)

  const questions = useMemo(() => buildSpeedBoardQuestions({ seed, level }), [seed, level])
  const timeLimitMs =
    SPEED_BOARD.timeLimits[Math.min(level, SPEED_BOARD.timeLimits.length - 1)] ??
    SPEED_BOARD.timeLimits[0]!
  const size = SPEED_BOARD.size
  const center = centerIndex(size)

  const answersRef = useRef(new Map<string, number>())

  // 終了時に ref の中身を state へ写す。結果は state から出す
  // （描画中に ref を読まないため）。
  const [finalAnswers, setFinalAnswers] = useState<ReadonlyMap<string, number>>(new Map())

  const countdown = useCountdown({
    durationMs: timeLimitMs,
    onFinish: () => {
      setFinalAnswers(new Map(answersRef.current))
      setPhase('result')
    },
  })

  const { start } = countdown
  const running = phase === 'running'
  useEffect(() => {
    if (running) start()
  }, [running, start])

  const question = questions[index]

  const answer = (picked: number) => {
    if (!countdown.running || !question || feedback !== null) return
    answersRef.current.set(question.id, picked)
    setFeedback({ picked, correct: picked === question.answerIndex })

    window.setTimeout(() => {
      setFeedback(null)
      if (index + 1 >= questions.length) countdown.finish()
      else setIndex((current) => current + 1)
    }, 300)
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="読書内容への集中"
        title="スピードボード"
        onStart={() => {
          answersRef.current = new Map()
          setIndex(0)
          setFeedback(null)
          setPhase('running')
        }}
      >
        <p>
          {size}×{size} の盤の
          <strong className="text-fg">真ん中</strong>から、指示のとおりに動きます。
          動いた先のマスを押してください。
        </p>
        <p>
          盤を指でたどらず、頭の中で動かしてください。動いた跡は出しません。
          {questions.length} 問を {Math.round(timeLimitMs / 1000)} 秒で。
        </p>
      </BtrIntro>
    )
  }

  if (phase === 'running' && question) {
    return (
      <>
        <BtrTimerBar
          remainingMs={countdown.remainingMs}
          progress={countdown.progress}
          detail={`${index + 1} / ${questions.length} 問`}
        />
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 pt-14 pb-6 sm:px-8">
          <p className="text-xs text-fg-muted">真ん中から</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {question.steps
              .map((step) => `${BOARD_DIRECTION_LABELS[step.direction]}に ${step.distance}`)
              .join('、')}
          </p>

          <div
            className="mt-8 grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: size * size }, (_, cell) => {
              const isCenter = cell === center
              const chosen = feedback?.picked === cell
              const isAnswer = cell === question.answerIndex
              return (
                <button
                  key={cell}
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault()
                    answer(cell)
                  }}
                  className={cn(
                    'aspect-square rounded-xl border transition-colors select-none',
                    feedback === null && 'border-border bg-surface hover:bg-surface-muted',
                    feedback !== null && isAnswer && 'border-positive bg-positive/20',
                    feedback !== null && chosen && !isAnswer && 'border-negative bg-negative/20',
                    feedback !== null && !isAnswer && !chosen && 'border-border opacity-40',
                  )}
                >
                  {/* 真ん中の印だけを出す。動いた跡は出さない。 */}
                  {isCenter ? (
                    <span aria-hidden className="mx-auto block size-2 rounded-full bg-fg-subtle" />
                  ) : null}
                </button>
              )
            })}
          </div>
        </main>
      </>
    )
  }

  const result = scoreSpeedBoard(questions, finalAnswers)
  return (
    <BtrResult
      title="スピードボード"
      score={result.correct}
      scoreUnit={`問正解（全 ${result.total} 問）`}
      lines={[
        { label: '誤り', value: `${result.wrong} 問` },
        { label: '手つかず', value: `${result.unanswered} 問` },
        { label: '正答率', value: `${result.accuracy}%` },
      ]}
      onNext={() =>
        onComplete({ score: result.correct, accuracy: result.accuracy, timeLimitMs })
      }
    />
  )
}
