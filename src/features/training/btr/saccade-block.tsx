'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SACCADE_AXIS_LABELS,
  buildSaccadeSchedule,
  saccadeAxisFor,
  scoreSaccade,
  type SaccadeAnswer,
  type SaccadeAxis,
  type SaccadeSide,
} from '@/core/training/btr/saccade'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrScreen, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'

/**
 * サッケイド（BTRメソッド 認知視野拡大）
 *
 * 上下（たて）または左右（よこ）のマーカー間で視線を往復させる。
 * **文字は出さない。** 眼球運動だけに集中するのがこの種目の核心である。
 *
 * 教室では紙のシートを見て自分で往復数を数えるが、アプリで自己申告にすると
 * 数字だけが上がって訓練にならない。ここでは点灯した側を答えてもらい、
 * 正答数を往復数とする。点灯側を知るには視線を動かすほかない。
 */

/** ブロックの長さ。教室のスコア（30秒で57往復など）に合わせる。 */
const DURATION_MS = 30_000

export interface SaccadeBlockProps {
  /** その日の向きを決める種。日付を渡す。 */
  readonly seed: string
  /** 級（0 始まり）。上がるほど点灯が速くなる。 */
  readonly level?: number
  readonly onComplete: (outcome: {
    axis: SaccadeAxis
    score: number
    accuracy: number
    total: number
  }) => void
}

/** 級ごとの点灯間隔（ms）。上がるほど短くなる。 */
const INTERVALS_MS = [700, 600, 500, 420, 360, 300]

type Phase = 'intro' | 'running' | 'result'

export function SaccadeBlock({ seed, level = 0, onComplete }: SaccadeBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [answers, setAnswers] = useState<SaccadeAnswer[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  /** 実行中に出す往復数。押した回数ではなく、正しく押せた回数を数える。 */
  const [hitCount, setHitCount] = useState(0)
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)

  const axis = useMemo(() => saccadeAxisFor(seed), [seed])
  const intervalMs = INTERVALS_MS[Math.min(level, INTERVALS_MS.length - 1)] ?? INTERVALS_MS[0]!

  const schedule = useMemo(
    () => buildSaccadeSchedule({ axis, intervalMs, durationMs: DURATION_MS, seed }),
    [axis, intervalMs, seed],
  )

  // 回答は毎フレーム触るので ref に持つ。state だけだと、
  // setInterval が閉じ込めた古い値を見て取りこぼす。
  const answersRef = useRef<SaccadeAnswer[]>([])
  const stepRef = useRef(0)

  const countdown = useCountdown({
    durationMs: DURATION_MS,
    onFinish: () => {
      setAnswers([...answersRef.current])
      setPhase('result')
    },
  })

  // 点灯の切り替え。経過時間から今どの点灯かを引く。
  useEffect(() => {
    if (!countdown.running) return
    const next = Math.min(schedule.steps.length - 1, Math.floor(countdown.elapsedMs / intervalMs))
    if (next !== stepRef.current) {
      stepRef.current = next
      setStepIndex(next)
      setFlash(null)
    }
  }, [countdown.elapsedMs, countdown.running, intervalMs, schedule.steps.length])

  const current = schedule.steps[stepIndex]

  const answer = useCallback(
    (side: SaccadeSide) => {
      if (!countdown.running || !current) return
      // 同じ点灯には一度だけ。連打で往復数を稼げないようにする。
      if (answersRef.current.some((entry) => entry.index === current.index)) return
      answersRef.current = [...answersRef.current, { index: current.index, side }]
      const correct = side === current.side
      if (correct) setHitCount((count) => count + 1)
      setFlash(correct ? 'hit' : 'miss')
    },
    [countdown.running, current],
  )

  // キーボードでも答えられるようにする。たては上下キー、よこは左右キー。
  useEffect(() => {
    if (!countdown.running) return
    const onKey = (event: KeyboardEvent) => {
      const keys =
        axis === 'vertical'
          ? { start: 'ArrowUp', end: 'ArrowDown' }
          : { start: 'ArrowLeft', end: 'ArrowRight' }
      if (event.key === keys.start) {
        event.preventDefault()
        answer('start')
      } else if (event.key === keys.end) {
        event.preventDefault()
        answer('end')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer, axis, countdown.running])

  const start = () => {
    answersRef.current = []
    stepRef.current = 0
    setAnswers([])
    setStepIndex(0)
    setHitCount(0)
    setPhase('running')
    countdown.start()
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="認知視野の拡大"
        title={SACCADE_AXIS_LABELS[axis]}
        onStart={start}
      >
        <p>
          {axis === 'vertical' ? '上下' : '左右'}のマークが交互に光ります。
          <strong className="text-fg">光ったほうを押してください。</strong>
          30秒間、続けます。
        </p>
        <p>
          文字は出しません。読もうとせず、視線だけを動かしてください。
          正しく押せた回数が「往復数」になります。
        </p>
        <p className="text-xs">
          {axis === 'vertical' ? '↑ ↓ キー' : '← → キー'}でも答えられます。
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
          detail={`${hitCount} 往復`}
        />
        <SaccadeField axis={axis} lit={current?.side ?? null} flash={flash} onAnswer={answer} />
      </>
    )
  }

  const result = scoreSaccade(schedule, answers)
  return (
    <BtrResult
      title={SACCADE_AXIS_LABELS[axis]}
      score={result.hits}
      scoreUnit="往復"
      lines={[
        { label: '正しく押せた', value: `${result.hits} 回` },
        { label: '押し間違い', value: `${result.misses} 回` },
        { label: '押せなかった', value: `${result.skipped} 回` },
        { label: '正確さ', value: `${result.accuracy}%` },
      ]}
      note="教室の紙のシートとは数え方が違うため、点数の絶対値は比べられません。自分の推移だけを見てください。"
      onNext={() =>
        onComplete({
          axis,
          score: result.hits,
          accuracy: result.accuracy,
          total: result.total,
        })
      }
    />
  )
}

interface SaccadeFieldProps {
  readonly axis: SaccadeAxis
  readonly lit: SaccadeSide | null
  readonly flash: 'hit' | 'miss' | null
  readonly onAnswer: (side: SaccadeSide) => void
}

/**
 * 2つのマークと、その下に置く回答ボタン。
 *
 * マークどうしはできるだけ離す。近いと視線がほとんど動かず、
 * 眼球運動の訓練にならない。
 */
function SaccadeField({ axis, lit, flash, onAnswer }: SaccadeFieldProps) {
  const vertical = axis === 'vertical'

  return (
    <main className="flex min-h-dvh flex-col px-5 pt-14 pb-6 sm:px-8">
      <div
        className={cn(
          'flex flex-1 items-center justify-center',
          vertical ? 'flex-col gap-[max(18vh,8rem)]' : 'flex-row gap-[max(60vw,18rem)]',
        )}
      >
        <Marker on={lit === 'start'} flash={flash} />
        <Marker on={lit === 'end'} flash={flash} />
      </div>

      <div className={cn('mx-auto flex w-full max-w-md gap-3', vertical && 'flex-col')}>
        <AnswerButton label={vertical ? '上' : '左'} onPress={() => onAnswer('start')} />
        <AnswerButton label={vertical ? '下' : '右'} onPress={() => onAnswer('end')} />
      </div>
    </main>
  )
}

function Marker({ on, flash }: { on: boolean; flash: 'hit' | 'miss' | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block size-16 rounded-full transition-colors duration-75 sm:size-20',
        !on && 'bg-surface-muted',
        on && flash === null && 'bg-brand',
        on && flash === 'hit' && 'bg-positive',
        on && flash === 'miss' && 'bg-negative',
      )}
    />
  )
}

function AnswerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      // pointerdown で拾う。click だと押してから反応するまでが遅く、速い点灯に追いつけない。
      onPointerDown={(event) => {
        event.preventDefault()
        onPress()
      }}
      className="h-16 flex-1 rounded-2xl border border-border bg-surface text-lg font-medium transition-colors select-none active:bg-surface-muted"
    >
      {label}
    </button>
  )
}
