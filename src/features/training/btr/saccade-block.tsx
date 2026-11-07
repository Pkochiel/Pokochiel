'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  SACCADE,
  SACCADE_AXIS_LABELS,
  buildSaccadeSheet,
  saccadeAxisFor,
  saccadeLapMs,
  scoreSaccade,
  type SaccadeAxis,
} from '@/core/training/btr/saccade'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrScreen, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * サッケイド（BTRメソッド 認知視野拡大）
 *
 * 実物のシートと同じ形を出す。点線が8本並び、端に印があるだけで、
 * 途中には何も書かれていない。**文字を一切介在させない。**
 *
 * **1往復 = 8本を通し終えること。** 1本ずつ端から端へ視線を送り、
 * 8本すべてを通ったところで画面を押す。押した回数が往復数になる。
 *
 * 自己申告なので数字は盛れるが、それは紙のシートでも同じである。
 * 「印が光った側を答える」形にすると検証はできるが、速さの上限が反応時間で
 * 決まってしまい、自分のペースで最速で動かすというこの種目の中身が消える。
 */

export type SaccadeBlockProps = BtrBlockProps

type Phase = 'intro' | 'running' | 'adjust' | 'result'

export function SaccadeBlock({ seed, level = 0, onComplete }: SaccadeBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [laps, setLaps] = useState(0)
  const [elapsedMs, setElapsedMs] = useState<number>(SACCADE.durationMs)

  const axis = useMemo(() => saccadeAxisFor(seed), [seed])
  const lines = useMemo(() => buildSaccadeSheet(), [])
  const targetIntervalMs =
    SACCADE.intervalsMs[Math.min(level, SACCADE.intervalsMs.length - 1)] ??
    SACCADE.intervalsMs[0]!

  const countdown = useCountdown({
    durationMs: SACCADE.durationMs,
    onFinish: (finishedAt) => {
      setElapsedMs(finishedAt)
      setPhase('adjust')
    },
  })

  const { start } = countdown
  const running = phase === 'running'
  useEffect(() => {
    if (running) start()
  }, [running, start])

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="認知視野の拡大"
        title={SACCADE_AXIS_LABELS[axis]}
        onStart={() => {
          setLaps(0)
          setPhase('running')
        }}
      >
        <p>
          {axis === 'vertical' ? '縦' : '横'}線が {lines.length} 本並びます。
          1本ずつ端から端へ視線を送り、
          <strong className="text-fg">
            {lines.length} 本すべてを通ったところで画面を押してください。
          </strong>
          それで1往復です。
        </p>
        <p>
          文字はありません。読もうとせず、印から印へ目だけを飛ばしてください。
          押した回数がそのまま往復数になります。
        </p>
        {axis === 'horizontal' ? (
          <p className="text-xs">
            端末を横にすると、視線を動かす幅が広がります。
          </p>
        ) : null}
        <p className="text-xs">
          {Math.round(SACCADE.durationMs / 1000)} 秒。いまの級の目安は
          1本 {targetIntervalMs} ミリ秒（
          {Math.round(SACCADE.durationMs / saccadeLapMs(targetIntervalMs))} 往復）です。
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
          detail={`${laps} 往復`}
        />
        <SaccadeSheet
          axis={axis}
          lines={lines}
          laps={laps}
          onLap={() => setLaps((current) => current + 1)}
        />
      </>
    )
  }

  if (phase === 'adjust') {
    return (
      <BtrScreen>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          {SACCADE_AXIS_LABELS[axis]}
        </p>
        <h2 className="mt-3 text-lg font-medium sm:text-xl">往復数を確かめてください</h2>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          {lines.length} 本を通し終えるごとに1往復です。押した回数を数えています。
          数え落としや押しすぎがあれば直してください。
        </p>

        <div className="mt-6 flex items-center gap-4">
          <Button
            variant="secondary"
            size="lg"
            aria-label="1 減らす"
            onClick={() => setLaps((current) => Math.max(0, current - 1))}
          >
            −
          </Button>
          <span className="tabular w-20 text-center text-4xl font-semibold">{laps}</span>
          <Button
            variant="secondary"
            size="lg"
            aria-label="1 増やす"
            onClick={() => setLaps((current) => current + 1)}
          >
            ＋
          </Button>
        </div>

        <Button size="lg" className="mt-8 w-full sm:w-auto" onClick={() => setPhase('result')}>
          この数で記録する
        </Button>
      </BtrScreen>
    )
  }

  const result = scoreSaccade(laps, elapsedMs)
  return (
    <BtrResult
      title={SACCADE_AXIS_LABELS[axis]}
      score={result.laps}
      scoreUnit="往復"
      lines={[
        { label: '視線を送った本数', value: `${result.lineTraversals} 本` },
        { label: '1本あたり', value: `${result.msPerLine} ミリ秒` },
        { label: '1分あたり', value: `${result.perMinute} 往復` },
      ]}
      note="自分で数えた数字です。紙のシートと同じで、比べるのは自分の推移だけにしてください。"
      onNext={() =>
        onComplete({
          score: result.laps,
          // たてとよこを別々に残す。ひとつの推移にまとめると、
          // その日どちらをやったかで数字が跳ねる。
          variant: axis,
          elapsedMs: result.elapsedMs,
          timeLimitMs: targetIntervalMs,
        })
      }
    />
  )
}

interface SaccadeSheetProps {
  readonly axis: SaccadeAxis
  readonly lines: readonly { index: number; offset: number }[]
  readonly laps: number
  readonly onLap: () => void
}

/**
 * シートそのもの。
 *
 * 画面全体を押せるようにする。1往復ごとに押すので、狙って押す余裕はない
 * （狙わせると、目ではなく指の動きを測ることになる）。
 */
function SaccadeSheet({ axis, lines, laps, onLap }: SaccadeSheetProps) {
  const vertical = axis === 'vertical'

  return (
    <main className="flex min-h-dvh flex-col">
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault()
          onLap()
        }}
        aria-label="1往復ぶん数える"
        className="flex flex-1 w-full flex-col px-4 pt-14 pb-6 select-none sm:px-8"
      >
        <div className="relative flex-1 rounded-2xl border border-border bg-surface">
        {lines.map((line) => {
          // たては上下に、よこは左右に印を置く。線そのものは点線。
          // どの線も同じ見た目にする。押すのは8本を通し終えたときなので、
          // 「いま何本目か」はアプリからは分からない（紙のシートと同じ）。
          const position = `${8 + line.offset * 84}%`
          return (
            <div
              key={line.index}
              style={vertical ? { left: position } : { top: position }}
              className={cn(
                'absolute border-dashed border-border',
                vertical
                  ? 'top-[8%] bottom-[8%] -translate-x-1/2 border-l'
                  : 'inset-x-[8%] -translate-y-1/2 border-t',
              )}
            >
              <Marker axis={axis} at="start" />
              <Marker axis={axis} at="end" />
            </div>
          )
        })}
        </div>

        <p className="mt-4 text-center text-sm text-fg-muted">
          <span className="tabular text-2xl font-semibold text-fg">{laps}</span> 往復
        </p>
      </button>
    </main>
  )
}

/**
 * 線の端の印。
 *
 * 内側を向いた三角。実物のシートがそうなっていて、
 * どちらへ視線を送るのかが印の形だけで分かる。
 *
 * CSS の枠線で三角を作らず SVG にしてあるのは、向きと色の組み合わせが
 * 4通りあり、クラス名を組み立てる書き方だと Tailwind が拾えないため。
 */
function Marker({ axis, at }: { axis: SaccadeAxis; at: 'start' | 'end' }) {
  const vertical = axis === 'vertical'

  // 内側を指す三角。たては ▼（上端）と ▲（下端）、よこは ▶（左端）と ◀（右端）。
  const points = vertical
    ? at === 'start'
      ? '2,2 16,2 9,14'
      : '9,2 16,14 2,14'
    : at === 'start'
      ? '2,2 14,9 2,16'
      : '14,2 14,16 2,9'

  return (
    <svg
      viewBox="0 0 18 18"
      aria-hidden
      className={cn(
        'absolute size-[18px] text-fg',
        vertical
          ? at === 'start'
            ? '-top-[18px] -left-[9px]'
            : '-bottom-[18px] -left-[9px]'
          : at === 'start'
            ? '-left-[18px] -top-[9px]'
            : '-right-[18px] -top-[9px]',
      )}
    >
      <polygon points={points} fill="currentColor" />
    </svg>
  )
}
