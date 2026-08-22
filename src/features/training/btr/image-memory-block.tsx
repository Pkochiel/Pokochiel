'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  IMAGE_MEMORY,
  scoreImageMemory,
  type ImageMemorySet,
} from '@/core/training/btr/image-memory'
import { pickImageWords, toImagePairs } from '@/data/content/image-words'
import { Button } from '@/components/ui/button'
import { BtrIntro, BtrResult, BtrScreen, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'

/**
 * イメージ記憶 / イメージボード（BTRメソッド 読書内容への集中）
 *
 * 40語を制限時間で覚え、思い出せたものを書き出す。**同じ語で2セット**。
 * 級が上がるごとに制限時間が短くなる（2分 → 1分30秒 → 1分 → 45秒 → 30秒）。
 *
 * 語は上下2つずつ並べる。上下を結ぶ具体的なイメージを作って覚えるのがこつなので、
 * 画面の並べ方もそれに合わせる。
 */

export interface ImageMemoryBlockProps {
  readonly seed: string
  readonly level?: number
  readonly onComplete: (outcome: { score: number }) => void
}

type Phase = 'intro' | 'memorize' | 'recall' | 'result'

export function ImageMemoryBlock({ seed, level = 0, onComplete }: ImageMemoryBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [setIndex, setSetIndex] = useState(0)
  const [text, setText] = useState('')
  const [sets, setSets] = useState<ImageMemorySet[]>([])

  const words = useMemo(() => pickImageWords(seed), [seed])
  const pairs = useMemo(() => toImagePairs(words), [words])
  const timeLimitMs =
    IMAGE_MEMORY.timeLimits[Math.min(level, IMAGE_MEMORY.timeLimits.length - 1)] ??
    IMAGE_MEMORY.timeLimits[0]!

  const submitRecall = () => {
    const recalled = text
      .split('\n')
      .flatMap((line) => line.split(/[、,・\s　]+/))
      .filter((word) => word.trim().length > 0)

    const next = [...sets, { index: setIndex, recalled }]
    setSets(next)
    setText('')

    if (next.length >= IMAGE_MEMORY.sets) setPhase('result')
    else {
      setSetIndex(next.length)
      setPhase('memorize')
    }
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="読書内容への集中"
        title="イメージ記憶"
        onStart={() => {
          setSets([])
          setSetIndex(0)
          setText('')
          setPhase('memorize')
        }}
      >
        <p>
          {words.length} 個の語を {Math.round(timeLimitMs / 1000)} 秒で覚え、
          思い出せたものを書き出します。
          <strong className="text-fg">
            同じ語で {IMAGE_MEMORY.sets} セット行います。
          </strong>
        </p>
        <p>
          語は上下2つずつ並びます。上下を結ぶ場面をひとつ思い浮かべると残ります。
          ばかばかしいほど鮮明なイメージほど、あとで出てきます。
        </p>
      </BtrIntro>
    )
  }

  if (phase === 'memorize') {
    return (
      <MemorizeRun
        key={setIndex}
        pairs={pairs}
        setNumber={setIndex + 1}
        setTotal={IMAGE_MEMORY.sets}
        timeLimitMs={timeLimitMs}
        onFinish={() => setPhase('recall')}
      />
    )
  }

  if (phase === 'recall') {
    return (
      <BtrScreen>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          {setIndex + 1} / {IMAGE_MEMORY.sets} セット目
        </p>
        <h2 className="mt-3 text-lg font-medium sm:text-xl">思い出せた語を書いてください</h2>
        <p className="mt-3 text-sm text-fg-muted">
          順番は問いません。1行に1つでも、読点で区切っても構いません。
        </p>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          autoFocus
          placeholder={'やかん\nきりん\nすいか …'}
          className="mt-5 w-full resize-y rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed"
        />

        <Button size="lg" className="mt-5 w-full sm:w-auto" onClick={submitRecall}>
          {setIndex + 1 >= IMAGE_MEMORY.sets ? '結果へ' : '次のセットへ'}
        </Button>
      </BtrScreen>
    )
  }

  const result = scoreImageMemory(words, sets)
  return (
    <BtrResult
      title="イメージ記憶"
      score={result.score}
      scoreUnit={`語（${result.attempts.join('・')}）`}
      lines={[
        { label: 'どちらかで思い出せた語', value: `${result.unionRecalled} / ${result.total}` },
        {
          label: '出題になかった語',
          value: `${result.sets.reduce((sum, set) => sum + set.intruded, 0)} 個`,
        },
      ]}
      note={`主スコアは ${IMAGE_MEMORY.sets} セットのうち良いほうです。合計にすると同じ語を二重に数えてしまいます。`}
      onNext={() => onComplete({ score: result.score })}
    />
  )
}

interface MemorizeRunProps {
  readonly pairs: readonly [string, string | null][]
  readonly setNumber: number
  readonly setTotal: number
  readonly timeLimitMs: number
  readonly onFinish: () => void
}

/** 覚える時間。制限時間はこの部品の寿命と一致する。 */
function MemorizeRun({ pairs, setNumber, setTotal, timeLimitMs, onFinish }: MemorizeRunProps) {
  const countdown = useCountdown({ durationMs: timeLimitMs, onFinish })
  const { start } = countdown
  useEffect(() => start(), [start])

  return (
    <>
      <BtrTimerBar
        remainingMs={countdown.remainingMs}
        progress={countdown.progress}
        detail={`${setNumber} / ${setTotal} セット目・覚える`}
      />
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 pt-14 pb-6 sm:px-8">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {pairs.map(([top, bottom]) => (
            <div
              key={`${top}-${bottom ?? ''}`}
              className="rounded-xl border border-border bg-surface px-3 py-3 text-center"
            >
              <p className="text-sm font-medium sm:text-base">{top}</p>
              {bottom ? (
                <>
                  <span aria-hidden className="mx-auto my-1.5 block h-px w-6 bg-border" />
                  <p className="text-sm font-medium sm:text-base">{bottom}</p>
                </>
              ) : null}
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mx-auto mt-6"
          onClick={() => countdown.finish()}
        >
          覚えた・先へ進む
        </Button>
      </main>
    </>
  )
}
