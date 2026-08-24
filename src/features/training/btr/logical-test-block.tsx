'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LOGICAL_ANSWER_LABELS,
  LOGICAL_TEST,
  buildLogicalQuestions,
  scoreLogicalTest,
  type LogicalAnswer,
} from '@/core/training/btr/logical-test'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * ロジカルテスト（BTRメソッド 読書内容への集中）
 *
 * 前提から結論が導けるかを判定する。30問・制限時間つき。
 * 答えは「正しい / 誤り / 判断できない」の3択。
 * 前提がつながらない出題が混ざるので、2択では成立しない。
 */

const ANSWERS: readonly LogicalAnswer[] = ['true', 'false', 'unknown']

export type LogicalTestBlockProps = BtrBlockProps

type Phase = 'intro' | 'running' | 'result'

export function LogicalTestBlock({ seed, level = 0, onComplete }: LogicalTestBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)

  const questions = useMemo(() => buildLogicalQuestions(seed), [seed])
  const timeLimitMs =
    LOGICAL_TEST.timeLimits[Math.min(level, LOGICAL_TEST.timeLimits.length - 1)] ??
    LOGICAL_TEST.timeLimits[0]!

  const answersRef = useRef(new Map<string, LogicalAnswer>())

  // 終了時に ref の中身を state へ写す。結果は state から出す
  // （描画中に ref を読まないため）。
  const [finalAnswers, setFinalAnswers] = useState<ReadonlyMap<string, LogicalAnswer>>(new Map())

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

  const answer = (value: LogicalAnswer) => {
    if (!countdown.running || !question) return
    answersRef.current.set(question.id, value)
    // 正誤は見せずに次へ。30問を時間内にどれだけ処理できるかを見る種目なので、
    // 1問ずつ振り返らせると流れが切れる。答え合わせは最後にまとめて。
    if (index + 1 >= questions.length) countdown.finish()
    else setIndex((current) => current + 1)
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="読書内容への集中"
        title="ロジカルテスト"
        onStart={() => {
          answersRef.current = new Map()
          setIndex(0)
          setPhase('running')
        }}
      >
        <p>
          前提を読み、下の結論が
          <strong className="text-fg">
            「正しい」「誤り」「判断できない」
          </strong>
          のどれかを選びます。
        </p>
        <p>
          前提だけでは決まらない問題が混ざっています。決まらないときは
          「判断できない」を選んでください。
        </p>
        <p>
          {questions.length} 問を {Math.round(timeLimitMs / 1000)} 秒で。
          迷ったら飛ばさず、いまの判断で答えて先へ進んでください。
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
          <ul className="space-y-1.5">
            {question.premises.map((premise) => (
              <li
                key={premise}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed"
              >
                {premise}
              </li>
            ))}
          </ul>

          <p className="mt-5 text-xs text-fg-muted">この結論は？</p>
          <p className="mt-2 rounded-xl border border-brand bg-brand-soft px-4 py-3 text-base leading-relaxed font-medium">
            {question.conclusion}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {ANSWERS.map((value) => (
              <button
                key={value}
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault()
                  answer(value)
                }}
                className={cn(
                  'h-16 rounded-xl border border-border bg-surface text-sm font-medium',
                  'transition-colors select-none active:bg-surface-muted',
                )}
              >
                {LOGICAL_ANSWER_LABELS[value]}
              </button>
            ))}
          </div>
        </main>
      </>
    )
  }

  const result = scoreLogicalTest(questions, finalAnswers)
  return (
    <BtrResult
      title="ロジカルテスト"
      score={result.correct}
      scoreUnit={`問正解（全 ${result.total} 問）`}
      lines={[
        { label: '誤り', value: `${result.wrong} 問` },
        { label: '手つかず', value: `${result.unanswered} 問` },
        { label: '正答率', value: `${result.accuracy}%` },
      ]}
      note="正答率の分母は全問です。時間内にどれだけ処理できたかを見る種目なので、解いた分だけで割りません。"
      onNext={() =>
        onComplete({ score: result.correct, accuracy: result.accuracy, timeLimitMs })
      }
    />
  )
}
