'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  NUMBER_RANDOM,
  buildNumberRandomSheets,
  combineNumberRandom,
  scoreSequential,
  type ScatterSheet,
  type SequentialResult,
} from '@/core/training/btr/number-random'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'

/**
 * 数字ランダム（BTRメソッド 認知視野拡大）
 *
 * 1〜99 が散らばった盤を **1から順に拾う**。制限時間内にどこまで到達できたか。
 * 4枚のシートを続けて行い、記録は「22・20・18・24」のように各枚の到達数を並べる。
 */

export interface NumberRandomBlockProps {
  readonly seed: string
  readonly level?: number
  readonly onComplete: (outcome: { score: number }) => void
}

type Phase = 'intro' | 'running' | 'result'

export function NumberRandomBlock({ seed, level = 0, onComplete }: NumberRandomBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [sheetIndex, setSheetIndex] = useState(0)
  const [results, setResults] = useState<SequentialResult[]>([])

  const sheets = useMemo(() => buildNumberRandomSheets(seed), [seed])
  const timeLimitMs =
    NUMBER_RANDOM.timeLimits[Math.min(level, NUMBER_RANDOM.timeLimits.length - 1)] ??
    NUMBER_RANDOM.timeLimits[0]!

  const finishSheet = useCallback(
    (result: SequentialResult) => {
      setResults((current) => {
        const next = [...current, result]
        if (next.length >= sheets.length) setPhase('result')
        else setSheetIndex(next.length)
        return next
      })
    },
    [sheets.length],
  )

  const sheet = sheets[sheetIndex]

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="認知視野の拡大"
        title="数字ランダム"
        onStart={() => {
          setResults([])
          setSheetIndex(0)
          setPhase('running')
        }}
      >
        <p>
          1 から 99 が散らばっています。
          <strong className="text-fg">1、2、3 … と順に押してください。</strong>
        </p>
        <p>
          順番を飛ばした押下では進みません。{NUMBER_RANDOM.sheets} 枚を続けて行い、
          1枚あたり {Math.round(timeLimitMs / 1000)} 秒です。
        </p>
        <p>盤の一部だけを見るのではなく、全体を見渡して次の数を探してください。</p>
      </BtrIntro>
    )
  }

  if (phase === 'running' && sheet) {
    return (
      // key で作り直す。カウントダウンは一度終わると再開しないので、
      // 1枚ぶんをまるごと作り直すのが確実。
      <SheetRun
        key={sheet.id}
        sheet={sheet}
        sheetNumber={sheetIndex + 1}
        sheetTotal={sheets.length}
        timeLimitMs={timeLimitMs}
        onFinish={finishSheet}
      />
    )
  }

  const combined = combineNumberRandom(results)
  return (
    <BtrResult
      title="数字ランダム"
      score={combined.reached}
      scoreUnit={`到達（${combined.attempts.join('・')}）`}
      lines={[
        { label: '1枚あたりの平均', value: `${combined.average}` },
        { label: '押し間違い', value: `${combined.wrong} 回` },
      ]}
      note="4枚それぞれの到達数を並べて記録します。合計より、枚ごとの並びのほうが調子の変化が見えます。"
      onNext={() => onComplete({ score: combined.reached })}
    />
  )
}

interface SheetRunProps {
  readonly sheet: ScatterSheet
  readonly sheetNumber: number
  readonly sheetTotal: number
  readonly timeLimitMs: number
  readonly onFinish: (result: SequentialResult) => void
}

/** 1枚ぶんの実行。制限時間はこの部品の寿命と一致する。 */
function SheetRun({ sheet, sheetNumber, sheetTotal, timeLimitMs, onFinish }: SheetRunProps) {
  const [reached, setReached] = useState(0)
  const [wrongFlash, setWrongFlash] = useState(false)

  // 押した並びは押すたびに触るので ref に持つ。
  const tapsRef = useRef<number[]>([])

  const countdown = useCountdown({
    durationMs: timeLimitMs,
    onFinish: () => onFinish(scoreSequential(tapsRef.current, sheet.max)),
  })

  // この部品は1枚ぶんの寿命しかないので、現れた時点で計時を始める。
  const { start } = countdown
  useEffect(() => start(), [start])

  const tap = (value: number) => {
    if (!countdown.running) return
    tapsRef.current = [...tapsRef.current, value]
    const result = scoreSequential(tapsRef.current, sheet.max)
    if (result.reached > reached) {
      setReached(result.reached)
      setWrongFlash(false)
      // 99 まで拾い切ったら時間を待たずに終える。
      if (result.reached >= sheet.max) countdown.finish()
    } else {
      setWrongFlash(true)
      window.setTimeout(() => setWrongFlash(false), 200)
    }
  }

  return (
    <>
      <BtrTimerBar
        remainingMs={countdown.remainingMs}
        progress={countdown.progress}
        detail={`${sheetNumber} / ${sheetTotal} 枚目・次は ${reached + 1}`}
      />
      <ScatterField sheet={sheet} reached={reached} wrongFlash={wrongFlash} onTap={tap} />
    </>
  )
}

interface ScatterFieldProps {
  readonly sheet: ScatterSheet
  readonly reached: number
  readonly wrongFlash: boolean
  readonly onTap: (value: number) => void
}

/**
 * 散らばった数字の盤。
 *
 * 拾い終えた数は薄くする。消してしまうと盤の見え方が途中で変わり、
 * 「同じ盤を最後まで走査する」課題でなくなる。
 */
function ScatterField({ sheet, reached, wrongFlash, onTap }: ScatterFieldProps) {
  return (
    <main className="flex min-h-dvh flex-col px-3 pt-14 pb-4 sm:px-6">
      <div
        className={cn(
          'relative flex-1 rounded-2xl border bg-surface transition-colors',
          wrongFlash ? 'border-negative' : 'border-border',
        )}
      >
        {sheet.points.map((point) => {
          const done = point.value <= reached
          return (
            <button
              key={point.value}
              type="button"
              onPointerDown={(event) => {
                event.preventDefault()
                onTap(point.value)
              }}
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              className={cn(
                'tabular absolute -translate-x-1/2 -translate-y-1/2 rounded-lg px-1.5 py-0.5',
                'text-sm tracking-tight transition-colors select-none sm:text-base',
                done ? 'text-fg-subtle/40' : 'text-fg hover:bg-surface-muted',
              )}
            >
              {point.value}
            </button>
          )
        })}
      </div>
    </main>
  )
}
