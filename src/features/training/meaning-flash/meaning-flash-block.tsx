'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { MEANING_FLASH } from '@/core/config/training-config'
import {
  adaptMeaningFlashLevel,
  exposureMsFor,
  scoreMeaningFlash,
} from '@/core/training/meaning-flash'
import { cn } from '@/lib/cn'
import { selectMeaningFlashItems, type MeaningFlashItem } from '@/data/content/meaning-flash'
import type { TrainingBlockProps } from '../shared/types'

type Phase = 'intro' | 'ready' | 'flash' | 'question' | 'result'

/**
 * Training 03: Meaning Flash
 *
 * 鍛える能力：短い露出から意味を取り出す速度（Meaning Extraction）。
 * 測り方：表示直後に「この文章が言いたかったことは？」を問い、正答率で測る。
 *
 * 文字列の記憶を問わないよう、設問は必ず意味を問う形にしてある。
 * 表示時間には下限（800ms）があり、極端なフラッシュ表示は行わない。
 */
export function MeaningFlashBlock({ chunkLevel, onComplete }: TrainingBlockProps) {
  const level = chunkLevel
  const exposureMs = exposureMsFor(level)

  const items = useMemo(
    () => selectMeaningFlashItems(level, MEANING_FLASH.itemsPerSession, `mf-${level}`),
    [level],
  )

  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<boolean[]>([])

  const item: MeaningFlashItem | undefined = items[index]

  // 表示前の間。不意打ちで文章が出ないようにする。
  useEffect(() => {
    if (phase !== 'ready') return
    const timeout = window.setTimeout(() => setPhase('flash'), MEANING_FLASH.readyDelayMs)
    return () => window.clearTimeout(timeout)
  }, [phase, index])

  // 露出。時間が来たら完全に隠す。
  useEffect(() => {
    if (phase !== 'flash') return
    const timeout = window.setTimeout(() => setPhase('question'), exposureMs)
    return () => window.clearTimeout(timeout)
  }, [phase, index, exposureMs])

  const answer = useCallback(
    (choiceId: string) => {
      if (!item) return
      const correct = choiceId === item.correctChoiceId
      const next = [...results, correct]
      setResults(next)

      if (index + 1 >= items.length) {
        setPhase('result')
        return
      }
      setIndex(index + 1)
      setPhase('ready')
    },
    [index, item, items.length, results],
  )

  if (!item && phase !== 'result') return null

  if (phase === 'intro') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          Meaning Flash
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">意味を取り出す</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          短い文章が {(exposureMs / 1000).toFixed(1)} 秒だけ表示され、すぐに消えます。
          その後で「何が言いたかったか」を選びます。全 {items.length} 問。
        </p>
        <p className="mt-2 text-xs text-fg-subtle">
          一字ずつ読もうとせず、全体を一度に見て意味を掴んでください。
          語句を覚える必要はありません。
        </p>
        <Button size="lg" className="mt-8 w-full sm:w-auto" onClick={() => setPhase('ready')}>
          Start
        </Button>
      </Centered>
    )
  }

  if (phase === 'ready') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-5">
        <ProgressBar
          value={(index + 1) / items.length}
          className="fixed inset-x-0 top-0 h-1 rounded-none"
          label="進捗"
        />
        <p className="text-sm text-fg-subtle">
          {index + 1} / {items.length}
        </p>
        <p className="mt-4 text-lg font-medium">まもなく表示します</p>
      </main>
    )
  }

  if (phase === 'flash' && item) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-5">
        <ProgressBar
          value={(index + 1) / items.length}
          className="fixed inset-x-0 top-0 h-1 rounded-none"
          label="進捗"
        />
        <p className="reading-serif mx-auto max-w-xl text-center text-xl leading-relaxed sm:text-2xl">
          {item.text}
        </p>
      </main>
    )
  }

  if (phase === 'question' && item) {
    return (
      <Centered>
        <p className="flex items-center gap-3 text-xs text-fg-muted">
          <span className="tabular">
            {index + 1} / {items.length}
          </span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5">Level {level}</span>
        </p>
        <h2 className="mt-4 text-lg leading-relaxed font-medium sm:text-xl">{item.prompt}</h2>
        <ul className="mt-6 space-y-2">
          {item.choices.map((choice) => (
            <li key={choice.id}>
              <button
                type="button"
                onClick={() => answer(choice.id)}
                className="w-full rounded-xl border border-border px-4 py-4 text-left text-sm leading-relaxed transition-colors hover:bg-surface-muted"
              >
                {choice.text}
              </button>
            </li>
          ))}
        </ul>
      </Centered>
    )
  }

  const score = scoreMeaningFlash(results)
  const nextLevel = adaptMeaningFlashLevel(level, score.accuracy)

  return (
    <Centered>
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Meaning Flash</p>
      <h2 className="mt-3 flex items-baseline gap-2 text-3xl font-semibold">
        <span className="tabular">{score.score}</span>
        <span className="text-sm font-normal text-fg-muted">
          / 100（{score.correct} / {score.total} 問正解）
        </span>
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">
        {nextLevel > level
          ? `意味を取れているので、次回は表示時間を短くします（Level ${nextLevel}）。`
          : nextLevel < level
            ? `取りこぼしが多いため、次回は表示時間を長くします（Level ${nextLevel}）。`
            : `Level ${level} を維持します。`}
      </p>

      <ul className="mt-6 space-y-2">
        {items.map((flashItem, i) => (
          <li
            key={flashItem.id}
            className={cn(
              'rounded-xl border p-4 text-sm leading-relaxed',
              results[i] ? 'border-border' : 'border-negative',
            )}
          >
            <p className="reading-serif">{flashItem.text}</p>
            <p className="mt-2 text-xs text-fg-subtle">{flashItem.explanation}</p>
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        className="mt-6 w-full sm:w-auto"
        onClick={() =>
          onComplete({
            accuracyScore: score.score,
            questionCount: score.total,
            level,
            exposureMs,
          })
        }
      >
        次へ
      </Button>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      {children}
    </main>
  )
}
