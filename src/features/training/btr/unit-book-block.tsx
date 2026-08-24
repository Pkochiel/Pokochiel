'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  UNIT_BOOK,
  buildUnitBookSet,
  scoreUnitBook,
} from '@/core/training/btr/unit-book'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'
import { VerticalText } from './shared/vertical-text'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * ユニットブック（BTRメソッド 認知視野拡大）
 *
 * よく似た8つの文が **縦書きで横に並ぶ**（縦一行ユニット）。
 * お題の文がどの列にあるかを探す。
 *
 * どの2列も1〜3か所しか違わないので、拾い読みでは当たらない。
 * 文の頭だけ見て決めると外れるところがこの種目の要点である。
 *
 * **お題は1セットのあいだ変わらない。** 変わるのは列の並びだけ。
 * 毎問お題を読み直す形にすると、探す時間より読む時間のほうが長くなる。
 */

export type UnitBookBlockProps = BtrBlockProps

type Phase = 'intro' | 'running' | 'result'

export function UnitBookBlock({ seed, level = 0, onComplete }: UnitBookBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<{ position: number; correct: boolean } | null>(null)

  const { target, questions } = useMemo(() => buildUnitBookSet({ seed }), [seed])
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
        <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center gap-5 px-3 pt-14 pb-6 sm:px-6">
          <div>
            <p className="text-xs text-fg-muted">この文を探す（セットのあいだ変わりません）</p>
            <p className="mt-2 rounded-xl border border-brand bg-brand-soft px-4 py-3 text-base font-medium">
              {target}
            </p>
          </div>

          {/*
            8列を横に並べ、文は縦書きにする。実物が「縦一行ユニット」で、
            同じような文が8列並ぶ形をしている。

            CSS の writing-mode を使わず、1文字ずつ縦に積んでいる。
            writing-mode に頼ると、縦組みの字送り情報を持たないフォントに
            当たったときに漢字が同じ位置に重なって出てしまう。
          */}
          <ul className="flex items-stretch justify-center gap-1 sm:gap-2">
            {question.columns.map((column) => {
              const chosen = feedback?.position === column.position
              const isAnswer = column.position === question.answerPosition
              return (
                <li key={column.position} className="flex-1">
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault()
                      answer(column.position)
                    }}
                    className={cn(
                      'flex w-full flex-col items-center rounded-xl border px-1 py-4',
                      'text-sm leading-none transition-colors select-none sm:text-base',
                      feedback === null && 'border-border bg-surface hover:bg-surface-muted',
                      feedback !== null && isAnswer && 'border-positive bg-positive/10',
                      feedback !== null &&
                        chosen &&
                        !isAnswer &&
                        'border-negative bg-negative/10',
                      feedback !== null && !isAnswer && !chosen && 'border-border opacity-40',
                    )}
                  >
                    <VerticalText text={column.text} />
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
      onNext={() =>
        onComplete({ score: result.correct, accuracy: result.accuracy, timeLimitMs })
      }
    />
  )
}
