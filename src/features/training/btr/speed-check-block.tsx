'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { SPEED_CHECK, buildSpeedCheckSheet, speedCheckTargetFor } from '@/core/training/btr/sheets'
import { scoreSearch } from '@/core/training/btr/visual-search'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * スピードチェック（BTRメソッド 読書内容への集中）
 *
 * 方角漢字（東・西・南・北）の2文字の組み合わせで埋めた盤から、
 * 指定された組み合わせを探す。似た字面が大量に並ぶので、
 * 字形ではなく組み合わせとして掴む必要がある。
 */

export type SpeedCheckBlockProps = BtrBlockProps

type Phase = 'intro' | 'running' | 'result'

export function SpeedCheckBlock({ seed, onComplete }: SpeedCheckBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set())

  const target = useMemo(() => speedCheckTargetFor(seed), [seed])
  const sheet = useMemo(() => buildSpeedCheckSheet(seed, target), [seed, target])

  const picksRef = useRef<number[]>([])

  // 終了時に ref の中身を state へ写す。結果は state から出す
  // （描画中に ref を読まないため）。
  const [finalPicks, setFinalPicks] = useState<readonly number[]>([])

  const countdown = useCountdown({
    durationMs: SPEED_CHECK.turnMs,
    onFinish: () => {
      setFinalPicks([...picksRef.current])
      setPhase('result')
    },
  })

  const { start } = countdown
  const running = phase === 'running'
  useEffect(() => {
    if (running) start()
  }, [running, start])

  const pick = (index: number) => {
    if (!countdown.running || picked.has(index)) return
    picksRef.current = [...picksRef.current, index]
    setPicked((current) => new Set(current).add(index))
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="読書内容への集中"
        title="スピードチェック"
        onStart={() => {
          picksRef.current = []
          setPicked(new Set())
          setPhase('running')
        }}
      >
        <p>
          方角の漢字を2つ組み合わせたものが並んでいます。そのなかから
          <strong className="text-fg">「{target}」だけを押してください。</strong>
        </p>
        <p>
          {Math.round(SPEED_CHECK.turnMs / 1000)} 秒です。
          「東西」と「西東」は別のものとして扱います。
        </p>
        <p>1文字ずつ確かめると間に合いません。2文字のかたまりとして見てください。</p>
      </BtrIntro>
    )
  }

  if (phase === 'running') {
    const found = sheet.cells.filter((cell) => cell.target && picked.has(cell.index)).length
    return (
      <>
        <BtrTimerBar
          remainingMs={countdown.remainingMs}
          progress={countdown.progress}
          detail={`「${target}」を探す・${found} 個`}
        />
        <main className="flex min-h-dvh flex-col px-3 pt-14 pb-4 sm:px-6">
          <div className="flex flex-1 items-center justify-center">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${sheet.columns}, minmax(0, 1fr))` }}
            >
              {sheet.cells.map((cell) => {
                const taken = picked.has(cell.index)
                return (
                  <button
                    key={cell.index}
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault()
                      pick(cell.index)
                    }}
                    className={cn(
                      'flex size-8 items-center justify-center rounded text-xs',
                      'transition-colors select-none sm:size-10 sm:text-sm',
                      taken
                        ? cell.target
                          ? 'bg-positive/20 text-positive'
                          : 'bg-negative/20 text-negative'
                        : 'bg-surface hover:bg-surface-muted',
                    )}
                  >
                    {cell.label}
                  </button>
                )
              })}
            </div>
          </div>
        </main>
      </>
    )
  }

  const result = scoreSearch(sheet, finalPicks)
  return (
    <BtrResult
      title="スピードチェック"
      score={result.found}
      scoreUnit={`個（全 ${result.total} 個中）`}
      lines={[
        { label: '見落とし', value: `${result.missed} 個` },
        { label: '押し間違い', value: `${result.wrong} 回` },
        { label: '正確さ', value: `${result.precision}%` },
      ]}
      onNext={() =>
        onComplete({
          score: result.found,
          accuracy: result.precision,
          elapsedMs: SPEED_CHECK.turnMs,
          timeLimitMs: SPEED_CHECK.turnMs,
        })
      }
    />
  )
}
