'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BP_SHEET, buildBpSheet, scoreBpSheet } from '@/core/training/btr/bp-sheet'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * BPシート（BTRメソッド 認知視野拡大）
 *
 * **動きの中で文字を判別する。** 数字ランダムの動く版にあたる。
 * 文字が次々に現れて一定時間で消えるので、消える前に対象を拾う。
 *
 * 消えた文字は押せない。ここが止まった盤との違いで、
 * 「戻って探し直す」ができないぶん、視野の広さがそのまま出る。
 */

export type BpSheetBlockProps = BtrBlockProps

type Phase = 'intro' | 'running' | 'result'

export function BpSheetBlock({ seed, level = 0, onComplete }: BpSheetBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [finalPicks, setFinalPicks] = useState<readonly string[]>([])

  const sheet = useMemo(() => buildBpSheet({ seed, level }), [seed, level])
  const picksRef = useRef<string[]>([])

  const countdown = useCountdown({
    durationMs: sheet.durationMs,
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

  // いま画面に出ている文字。経過時間から引く。
  const visible = sheet.items.filter(
    (item) =>
      item.appearsAtMs <= countdown.elapsedMs && item.disappearsAtMs > countdown.elapsedMs,
  )

  const pick = (id: string) => {
    if (!countdown.running || picked.has(id)) return
    picksRef.current = [...picksRef.current, id]
    setPicked((current) => new Set(current).add(id))
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="認知視野の拡大"
        title="BPシート"
        onStart={() => {
          picksRef.current = []
          setPicked(new Set())
          setPhase('running')
        }}
      >
        <p>
          ひらがなが次々に現れて、少しすると消えます。そのなかから
          <strong className="text-fg">「{sheet.targetLabel}」だけを押してください。</strong>
        </p>
        <p>
          消えた字は押せません。目で追いかけるのではなく、画面全体をぼんやり見て、
          目に飛び込んできたものを拾ってください。
        </p>
        <p className="text-xs">
          動きの速さは実物を確認できていないため暫定です。速すぎる・遅すぎると感じたら教えてください。
        </p>
      </BtrIntro>
    )
  }

  if (phase === 'running') {
    const found = sheet.items.filter((item) => item.target && picked.has(item.id)).length
    return (
      <>
        <BtrTimerBar
          remainingMs={countdown.remainingMs}
          progress={countdown.progress}
          detail={`「${sheet.targetLabel}」を探す・${found} 個`}
        />
        <main className="flex min-h-dvh flex-col px-3 pt-14 pb-4 sm:px-6">
          <div className="relative flex-1 rounded-2xl border border-border bg-surface">
            {visible.map((item) => {
              const taken = picked.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault()
                    pick(item.id)
                  }}
                  style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
                  className={cn(
                    'absolute -translate-x-1/2 -translate-y-1/2 rounded-lg px-2 py-1',
                    'text-xl transition-colors select-none sm:text-2xl',
                    taken
                      ? item.target
                        ? 'bg-positive/20 text-positive'
                        : 'bg-negative/20 text-negative'
                      : 'text-fg',
                  )}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </main>
      </>
    )
  }

  const result = scoreBpSheet(sheet, finalPicks)
  return (
    <BtrResult
      title="BPシート"
      score={result.found}
      scoreUnit={`個（全 ${result.total} 個中）`}
      lines={[
        { label: '見落とし', value: `${result.missed} 個` },
        { label: '押し間違い', value: `${result.wrong} 回` },
        { label: '正確さ', value: `${result.precision}%` },
      ]}
      note="消える前に拾えたものだけを数えます。"
      onNext={() =>
        onComplete({
          score: result.found,
          accuracy: result.precision,
          elapsedMs: sheet.durationMs,
          timeLimitMs: sheet.durationMs,
        })
      }
    />
  )
}
