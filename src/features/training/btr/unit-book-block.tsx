'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  UNIT_BOOK,
  buildUnitBookQuestions,
  scoreUnitBook,
} from '@/core/training/btr/unit-book'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'

/**
 * ユニットブック（BTRメソッド 認知視野拡大）
 *
 * よく似た8つの文が縦一行ずつ並ぶ。お題の文がどの列にあるかを探す。
 * どの2列も1〜3か所しか違わないので、拾い読みでは当たらない。
 * 文の頭だけ見て決めると外れるところがこの種目の要点である。
 */

export interface UnitBookBlockProps {
  readonly seed: string
  readonly level?: number
  readonly onComplete: (outcome: { score: number }) => void
}

type Phase = 'intro' | 'running' | 'result'

export function UnitBookBlock({ seed, level = 0, onComplete }: UnitBookBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<{ position: number; correct: boolean } | null>(null)

  const questions = useMemo(() => buildUnitBookQuestions({ seed }), [seed])
  const timeLimitMs =
    UNIT_BOOK.timeLimits[Math.min(level, UNIT_BOOK.timeLimits.length - 1)] ??
    UNIT_BOOK.timeLimits[0]!

  const answersRef = useRef(new Map<string, number>())
  const [answeredCount, setAnsweredCount] = useState(0)

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

  const answer = (position: number) => {
    if (!countdown.running || !question || feedback !== null) return
    answersRef.current.set(question.id, position)
    setAnsweredCount(answersRef.current.size)
    setFeedback({ position, correct: position === question.answerPosition })

    // 正誤を一瞬見せてから次へ。見せないと、外したことに気づかないまま続く。
    window.setTimeout(() => {
      setFeedback(null)
      if (index + 1 >= questions.length) countdown.finish()
      else setIndex((current) => current + 1)
    }, 350)
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="認知視野の拡大"
        title="ユニットブック"
        onStart={() => {
          answersRef.current = new Map()
          setAnsweredCount(0)
          setIndex(0)
          setFeedback(null)
          setPhase('running')
        }}
      >
        <p>
          よく似た {UNIT_BOOK.columns} つの文が並びます。
          <strong className="text-fg">お題と同じ文を押してください。</strong>
        </p>
        <p>
          どれも1〜3か所しか違いません。文の頭だけ見て決めると外れます。
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
        <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-5 pt-14 pb-6 sm:px-8">
          <p className="text-xs text-fg-muted">この文を探す</p>
          <p className="mt-2 rounded-xl border border-brand bg-brand-soft px-4 py-3 text-base font-medium">
            {question.target}
          </p>

          <ul className="mt-6 space-y-1.5">
            {question.columns.map((column) => {
              const chosen = feedback?.position === column.position
              const isAnswer = column.position === question.answerPosition
              return (
                <li key={column.position}>
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault()
                      answer(column.position)
                    }}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-left text-sm leading-relaxed',
                      'transition-colors select-none',
                      feedback === null && 'border-border bg-surface hover:bg-surface-muted',
                      feedback !== null && isAnswer && 'border-positive bg-positive/10',
                      feedback !== null &&
                        chosen &&
                        !isAnswer &&
                        'border-negative bg-negative/10',
                      feedback !== null && !isAnswer && !chosen && 'border-border opacity-40',
                    )}
                  >
                    {column.text}
                  </button>
                </li>
              )
            })}
          </ul>
        </main>
      </>
    )
  }

  const result = scoreUnitBook(questions, finalAnswers)
  return (
    <BtrResult
      title="ユニットブック"
      score={result.correct}
      scoreUnit={`問正解（全 ${result.total} 問）`}
      lines={[
        { label: '誤り', value: `${result.wrong} 問` },
        { label: '手つかず', value: `${result.unanswered} 問` },
        { label: '正答率', value: `${result.accuracy}%` },
      ]}
      note={
        answeredCount < questions.length
          ? '時間内に解けた分までを数えます。正答率の分母は全問です。'
          : undefined
      }
      onNext={() => onComplete({ score: result.correct })}
    />
  )
}
