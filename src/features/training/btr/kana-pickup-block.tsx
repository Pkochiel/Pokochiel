'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  KANA_PICKUP,
  buildKanaSheet,
  scoreKanaPickup,
} from '@/core/training/btr/kana-pickup'
import { pickKanaStory, selectKanaQuestions } from '@/data/content/kana-stories'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrScreen, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * かなひろい（BTRメソッド 読書内容への集中）
 *
 * 物語文を読みながら「あ・い・う・え・お」に印をつけ、そのあと内容を確認する。
 *
 * 拾っている最中は、正解・不正解を出さない。
 * 押した字が対象かどうかをその場で返すと、字を見ずに反応だけで拾えてしまい、
 * 読みながら拾うという課題が消える。答え合わせは終わってからまとめて行う。
 *
 * 内容確認は **読み終えたところまで** の問いだけを出す。
 * 読んでいない先を訊けば、測っているのは記憶ではなく運になる。
 */

export type KanaPickupBlockProps = BtrBlockProps

type Phase = 'intro' | 'running' | 'questions' | 'result'

export function KanaPickupBlock({ seed, onComplete }: KanaPickupBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set())
  const [finalPicks, setFinalPicks] = useState<readonly number[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [correct, setCorrect] = useState(0)

  const story = useMemo(() => pickKanaStory(seed), [seed])
  const sheet = useMemo(() => buildKanaSheet(story.lines), [story])
  const picksRef = useRef<number[]>([])

  const countdown = useCountdown({
    durationMs: KANA_PICKUP.durationMs,
    onFinish: () => {
      const picks = [...picksRef.current]
      setFinalPicks(picks)
      // 読めたところまでで問いを絞る。一行も進めていなければ内容確認は成立しない。
      setPhase(
        selectKanaQuestions(story, scoreKanaPickup(sheet, picks).reachedLine, seed).length > 0
          ? 'questions'
          : 'result',
      )
    },
  })

  const { start } = countdown
  const running = phase === 'running'
  useEffect(() => {
    if (running) start()
  }, [running, start])

  const result = scoreKanaPickup(sheet, finalPicks)
  const questions = useMemo(
    () => selectKanaQuestions(story, result.reachedLine, seed),
    [story, result.reachedLine, seed],
  )

  const mark = (index: number) => {
    if (!countdown.running || picked.has(index)) return
    picksRef.current = [...picksRef.current, index]
    setPicked((current) => new Set(current).add(index))
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="読書内容への集中"
        title="かなひろい"
        onStart={() => {
          picksRef.current = []
          setPicked(new Set())
          setQuestionIndex(0)
          setCorrect(0)
          setPhase('running')
        }}
      >
        <p>
          物語を読みながら、
          <strong className="text-fg">
            「{KANA_PICKUP.targets.join('・')}」を見つけたら押してください。
          </strong>
          なるべく速く、見落とさないように。
        </p>
        <p>
          <strong className="text-fg">物語の内容も考えながら</strong>
          進めてください。終わったあとに内容を訊きます。拾うだけになると、
          この訓練の意味がなくなります。
        </p>
        <p>
          制限時間は {Math.round(KANA_PICKUP.durationMs / 1000)} 秒です。
          読み切れる長さではないので、最後まで行かなくて構いません。
        </p>
      </BtrIntro>
    )
  }

  if (phase === 'running') {
    const found = sheet.chars.filter((char) => char.target && picked.has(char.index)).length
    return (
      <>
        <BtrTimerBar
          remainingMs={countdown.remainingMs}
          progress={countdown.progress}
          detail={`${found} 字`}
        />
        <main className="mx-auto w-full max-w-2xl px-4 pt-14 pb-10 sm:px-8">
          <h2 className="text-sm font-medium text-fg-muted">{story.title}</h2>
          {/*
            1文字ずつ押せるようにする。押す先を対象の字だけにすると、
            対象でない字を押した記録が取れず、拾い間違いを数えられない。
            文字ごとに手続きを付けず、まとめて受けて data-i から位置を読む。
          */}
          <div
            className="mt-4 space-y-1 select-none"
            onPointerDown={(event) => {
              const target = event.target as HTMLElement
              const index = target.dataset['i']
              if (index === undefined) return
              event.preventDefault()
              mark(Number(index))
            }}
          >
            {sheet.lines.map((line) => (
              <p key={line.index} className="text-lg leading-loose tracking-wide sm:text-xl">
                {line.chars.map((char) => (
                  <span
                    key={char.index}
                    data-i={char.index}
                    className={cn(
                      'inline-block px-px',
                      // 拾っている最中は当たり外れを見せない。
                      // その場で返すと、字を見ずに反応だけで拾えてしまう。
                      picked.has(char.index) &&
                        'rounded-full text-brand ring-1 ring-brand ring-inset',
                    )}
                  >
                    {char.char}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </main>
      </>
    )
  }

  if (phase === 'questions') {
    const question = questions[questionIndex]
    if (question) {
      return (
        <BtrScreen>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            内容の確認　{questionIndex + 1} / {questions.length}
          </p>
          <h2 className="mt-3 text-lg leading-relaxed font-medium sm:text-xl">
            {question.prompt}
          </h2>
          <div className="mt-6 space-y-2">
            {question.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault()
                  if (choice.id === question.correctChoiceId) setCorrect((n) => n + 1)
                  if (questionIndex + 1 >= questions.length) setPhase('result')
                  else setQuestionIndex((n) => n + 1)
                }}
                className={cn(
                  'w-full rounded-xl border border-border bg-surface px-4 py-3.5',
                  'text-left text-sm leading-relaxed transition-colors select-none',
                  'active:bg-surface-muted',
                )}
              >
                {choice.text}
              </button>
            ))}
          </div>
        </BtrScreen>
      )
    }
  }

  const scored = scoreKanaPickup(sheet, finalPicks, {
    asked: questions.length,
    correct,
  })

  return (
    <BtrResult
      title="かなひろい"
      score={scored.found}
      scoreUnit={`字（読んだ範囲に ${scored.reachedTargets} 字）`}
      lines={[
        { label: '見落とし', value: `${scored.missed} 字` },
        { label: '拾い間違い', value: `${scored.wrong} 字` },
        { label: '拾い率', value: `${scored.foundRatio}%` },
        {
          label: '読み進めた行',
          value: `${scored.reachedLine + 1} / ${scored.totalLines} 行`,
        },
        {
          label: '内容の正答',
          value:
            scored.comprehension === null
              ? '—'
              : `${scored.comprehension.correct} / ${scored.comprehension.asked}`,
        },
      ]}
      note="拾い率と内容の正答は、どちらか片方では意味がありません。拾いながら読めているかを見る種目です。"
      onNext={() =>
        onComplete({
          score: scored.found,
          accuracy: scored.foundRatio,
          elapsedMs: KANA_PICKUP.durationMs,
          timeLimitMs: KANA_PICKUP.durationMs,
        })
      }
    />
  )
}
