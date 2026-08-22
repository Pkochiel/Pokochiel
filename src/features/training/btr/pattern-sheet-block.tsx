'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PATTERN_SHEET,
  buildPatternSheet,
  isMarkedColumn,
  scorePatternSheet,
  type PatternPick,
  type PatternResult,
  type PatternSheet,
} from '@/core/training/btr/pattern-sheet'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'

/**
 * 漢数字一行（BTRメソッド 認知視野拡大 / パターンシート）
 *
 * 〇〜九の漢数字を縦書きに並べた列が右から左へ80本。
 * そこから対象の漢数字だけを拾う。一・二・三の3ターン、各90秒。
 *
 * 実物のシートに合わせ、列は縦書きで右から左に読む向きに置く。
 * 5刻みで列に番号を振る。
 */

export interface PatternSheetBlockProps {
  readonly seed: string
  readonly level?: number
  readonly onComplete: (outcome: { score: number }) => void
}

type Phase = 'intro' | 'running' | 'result'

export function PatternSheetBlock({ seed, onComplete }: PatternSheetBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [turn, setTurn] = useState(0)
  const [results, setResults] = useState<PatternResult[]>([])

  const targets = PATTERN_SHEET.targets
  const target = targets[turn]

  const finishTurn = useCallback(
    (result: PatternResult) => {
      setResults((current) => {
        const next = [...current, result]
        if (next.length >= targets.length) setPhase('result')
        else setTurn(next.length)
        return next
      })
    },
    [targets.length],
  )

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="認知視野の拡大"
        title="漢数字一行"
        onStart={() => {
          setResults([])
          setTurn(0)
          setPhase('running')
        }}
      >
        <p>
          〇から九までの漢数字が、縦書きの列で {PATTERN_SHEET.columnCount} 本並んでいます。
          <strong className="text-fg">
            指定された漢数字だけを押してください。
          </strong>
        </p>
        <p>
          「{targets.join('」「')}」の順に {targets.length} ターン、各{' '}
          {Math.round(PATTERN_SHEET.turnMs / 1000)} 秒です。
          いくつあるかは伝えません。端から順に見ていってください。
        </p>
        <p>列には5刻みで番号がついています。どこまで進んだかの目印です。</p>
      </BtrIntro>
    )
  }

  if (phase === 'running' && target) {
    return (
      // ターンごとに作り直す。カウントダウンは一度終わると再開しない。
      <TurnRun
        key={target}
        seed={seed}
        target={target}
        turnNumber={turn + 1}
        turnTotal={targets.length}
        onFinish={finishTurn}
      />
    )
  }

  const found = results.reduce((sum, result) => sum + result.found, 0)
  const wrong = results.reduce((sum, result) => sum + result.wrong, 0)
  const missed = results.reduce((sum, result) => sum + result.missed, 0)

  return (
    <BtrResult
      title="漢数字一行"
      score={found}
      scoreUnit={`個（${results.map((r) => r.found).join('・')}）`}
      lines={[
        {
          label: '到達した列',
          value: results.map((r) => r.reachedColumn).join('・'),
        },
        { label: '見落とし', value: `${missed} 個` },
        { label: '押し間違い', value: `${wrong} 回` },
      ]}
      note="ターンごとの拾えた数と、到達した列を並べて記録します。"
      onNext={() => onComplete({ score: found })}
    />
  )
}

interface TurnRunProps {
  readonly seed: string
  readonly target: string
  readonly turnNumber: number
  readonly turnTotal: number
  readonly onFinish: (result: PatternResult) => void
}

/** 1ターンぶんの実行。制限時間はこの部品の寿命と一致する。 */
function TurnRun({ seed, target, turnNumber, turnTotal, onFinish }: TurnRunProps) {
  const [sheet] = useState<PatternSheet>(() => buildPatternSheet({ seed, targetLabel: target }))
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())

  const picksRef = useRef<PatternPick[]>([])

  const countdown = useCountdown({
    durationMs: PATTERN_SHEET.turnMs,
    onFinish: () => onFinish(scorePatternSheet(sheet, picksRef.current)),
  })

  const { start } = countdown
  useEffect(() => start(), [start])

  const pick = (column: number, row: number) => {
    if (!countdown.running) return
    const key = `${column}:${row}`
    if (picked.has(key)) return
    picksRef.current = [...picksRef.current, { column, row }]
    setPicked((current) => new Set(current).add(key))
  }

  return (
    <>
      <BtrTimerBar
        remainingMs={countdown.remainingMs}
        progress={countdown.progress}
        detail={`${turnNumber} / ${turnTotal} ターン・「${target}」を探す`}
      />
      <PatternGrid sheet={sheet} picked={picked} onPick={pick} />
    </>
  )
}

interface PatternGridProps {
  readonly sheet: PatternSheet
  readonly picked: ReadonlySet<string>
  readonly onPick: (column: number, row: number) => void
}

/**
 * 縦書きの列を右から左へ並べる。
 *
 * 実物のシートは上下2段に折り返しているが、画面では段ごとに横スクロールさせる。
 * 折り返して詰め込むと1字が小さくなりすぎて、字を見分ける課題でなくなる。
 */
function PatternGrid({ sheet, picked, onPick }: PatternGridProps) {
  const bands = [...new Set(sheet.columns.map((column) => column.band))]

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-3 pt-14 pb-4 sm:px-6">
      {bands.map((band) => (
        <div
          key={band}
          // 右から左へ読む。行き先が右端になるよう dir を反転させる。
          dir="rtl"
          className="flex-1 overflow-x-auto rounded-2xl border border-border bg-surface p-2"
        >
          <div className="flex h-full min-w-max gap-0.5">
            {sheet.columns
              .filter((column) => column.band === band)
              .map((column) => (
                <div key={column.number} className="flex flex-col items-center">
                  <span className="tabular h-4 text-[10px] leading-4 text-fg-subtle">
                    {isMarkedColumn(column.number) ? column.number : ''}
                  </span>
                  {column.cells.map((cell) => {
                    const key = `${column.number}:${cell.row}`
                    const taken = picked.has(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onPointerDown={(event) => {
                          event.preventDefault()
                          onPick(column.number, cell.row)
                        }}
                        className={cn(
                          'flex size-6 items-center justify-center rounded text-xs',
                          'transition-colors select-none sm:size-7 sm:text-sm',
                          taken
                            ? cell.target
                              ? 'bg-positive/20 text-positive'
                              : 'bg-negative/20 text-negative'
                            : 'hover:bg-surface-muted',
                        )}
                      >
                        {cell.label}
                      </button>
                    )
                  })}
                </div>
              ))}
          </div>
        </div>
      ))}
    </main>
  )
}
