'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  SPEED_CHECK,
  buildSpeedCheckQuestions,
  scoreSpeedCheck,
} from '@/core/training/btr/speed-check'
import { timeLimitAt } from '@/core/training/btr/progression'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * スピードチェック（BTRメソッド 読書内容への集中）
 *
 * 方角漢字の3文字の組み合わせから、お題と同じものを探す。
 * **1問ずつ画面に出し、お題は1問ごとに変わる。**
 *
 * 同じお題を続けて探すと、2問目からは覚えた形を照合するだけになり、
 * 組み合わせを掴み直す訓練にならない。
 *
 * 選択肢には1字違いが全部入っているので、頭の1字だけ見て決めると必ず外れる。
 */

export type SpeedCheckBlockProps = BtrBlockProps

type Phase = 'intro' | 'running' | 'result'

/** 正誤を見せる時間（ms）。長いと流れが切れ、短いと見えない。 */
const FEEDBACK_MS = 350

export function SpeedCheckBlock({ seed, level = 0, onComplete }: SpeedCheckBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<{ position: number; correct: boolean } | null>(null)

  const questions = useMemo(() => buildSpeedCheckQuestions({ seed }), [seed])
  const timeLimitMs = timeLimitAt('speed_check', level) ?? SPEED_CHECK.timeLimits[0]!

  const answersRef = useRef(new Map<string, number>())

  // 終了時に ref の中身を state へ写す。結果は state から出す
  // （描画中に ref を読まないため）。
  const [finalAnswers, setFinalAnswers] = useState<ReadonlyMap<string, number>>(new Map())
  // 全問解き終えると時間より早く終わる。制限時間をそのまま記録すると、
  // 早く終えたことが記録に残らない。
  const [elapsedMs, setElapsedMs] = useState(timeLimitMs)

  const countdown = useCountdown({
    durationMs: timeLimitMs,
    onFinish: (finishedAt) => {
      setFinalAnswers(new Map(answersRef.current))
      setElapsedMs(finishedAt)
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
    setFeedback({ position, correct: position === question.answerPosition })

    window.setTimeout(() => {
      setFeedback(null)
      if (index + 1 >= questions.length) countdown.finish()
      else setIndex((current) => current + 1)
    }, FEEDBACK_MS)
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="読書内容への集中"
        title="スピードチェック"
        onStart={() => {
          answersRef.current = new Map()
          setIndex(0)
          setFeedback(null)
          setPhase('running')
        }}
      >
        <p>
          方角の漢字を並べた{SPEED_CHECK.length}文字の組み合わせが
          {SPEED_CHECK.optionCount} 個並びます。
          <strong className="text-fg">お題と同じものを押してください。</strong>
        </p>
        <p>
          <strong className="text-fg">お題は1問ごとに変わります。</strong>
          1字だけ違うものが必ず混ざっているので、頭の1字だけ見て決めると外れます。
          字の形ではなく、並びとして掴んでください。
        </p>
        <p className="text-xs">
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
        <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 pt-14 pb-6 sm:px-8">
          <p className="text-xs text-fg-muted">この組み合わせを探す</p>
          <p className="mt-2 rounded-xl border border-brand bg-brand-soft px-4 py-3 text-center text-2xl font-semibold tracking-[0.2em]">
            {question.target}
          </p>

          <div className="mt-5 grid grid-cols-5 gap-1.5 sm:gap-2">
            {question.options.map((option) => {
              const chosen = feedback?.position === option.position
              const isAnswer = option.position === question.answerPosition
              return (
                <button
                  key={option.position}
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault()
                    answer(option.position)
                  }}
                  className={cn(
                    'aspect-square rounded-lg border text-base font-medium',
                    'transition-colors select-none sm:text-lg',
                    feedback === null && 'border-border bg-surface active:bg-surface-muted',
                    feedback !== null && isAnswer && 'border-positive bg-positive/10',
                    feedback !== null && chosen && !isAnswer && 'border-negative bg-negative/10',
                    feedback !== null && !isAnswer && !chosen && 'border-border opacity-40',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </main>
      </>
    )
  }

  const result = scoreSpeedCheck(questions, finalAnswers)
  return (
    <BtrResult
      title="スピードチェック"
      score={result.correct}
      scoreUnit={`問正解（全 ${result.total} 問）`}
      lines={[
        { label: '誤り', value: `${result.wrong} 問` },
        { label: '手つかず', value: `${result.unanswered} 問` },
        { label: '正答率', value: `${result.accuracy}%` },
        { label: '所要時間', value: `${Math.round(elapsedMs / 1000)} 秒` },
      ]}
      note="正答率の分母は全問です。時間内にどれだけ処理できたかを見る種目なので、解いた分だけで割りません。"
      onNext={() =>
        onComplete({
          score: result.correct,
          accuracy: result.accuracy,
          elapsedMs,
          timeLimitMs,
        })
      }
    />
  )
}
