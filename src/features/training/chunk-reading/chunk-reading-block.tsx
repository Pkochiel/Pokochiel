'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { buildChunkGroups, chunkDisplayMs } from '@/core/chunking/segment'
import { scoreComprehension } from '@/core/metrics/comprehension'
import { readCheckQuestions } from '@/core/training/question-set'

import { QuestionRunner } from '../shared/question-runner'
import { usePrefersReducedMotion } from '../shared/use-reduced-motion'
import type { TrainingBlockProps } from '../shared/types'

type Phase = 'intro' | 'flashing' | 'questions'

/**
 * Training 02: Chunk Reading
 *
 * 文字単位ではなく意味のまとまりで認識する訓練。
 * 表示時間には下限（250ms）があり、目標速度を上げても点滅が速くなりすぎない。
 * 動きの抑制が有効な環境では自動送りをやめ、手動送りに切り替える。
 */
export function ChunkReadingBlock({
  passage,
  targetCpm,
  chunkLevel,
  minutes,
  onComplete,
}: TrainingBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  const groups = useMemo(
    () => buildChunkGroups(passage.chunks, chunkLevel),
    [passage.chunks, chunkLevel],
  )
  const questions = readCheckQuestions(passage.questions, minutes)
  const current = groups[index]

  // 更新関数の中で別の状態を変えない（純粋に保つ）ため、現在値から判断する
  const advance = useCallback(() => {
    if (index + 1 >= groups.length) {
      setPhase('questions')
      return
    }
    setIndex(index + 1)
  }, [index, groups.length])

  // 自動送り。表示時間はチャンクの文字数と目標速度から決まる。
  useEffect(() => {
    if (phase !== 'flashing' || reducedMotion || !current) return
    const timeout = window.setTimeout(
      advance,
      chunkDisplayMs(current.characterCount, targetCpm),
    )
    return () => window.clearTimeout(timeout)
  }, [phase, index, current, targetCpm, reducedMotion, advance])

  // 手動送り（キーボード）
  useEffect(() => {
    if (phase !== 'flashing' || !reducedMotion) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'ArrowRight') return
      event.preventDefault()
      advance()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, reducedMotion, advance])

  if (phase === 'intro') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          Chunk Reading
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          意味のまとまりで捉える
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          文章が {groups.length} 回に分けて表示されます。1文字ずつ追わず、
          かたまりごと視野に入れてください。Level {chunkLevel}。
        </p>
        {reducedMotion ? (
          <p className="mt-2 text-xs text-fg-subtle">
            動きの抑制が有効なため、Space キーまたはタップで自分のペースで送れます。
          </p>
        ) : null}
        <Button
          size="lg"
          className="mt-8 w-full sm:w-auto"
          onClick={() => {
            setIndex(0)
            setPhase('flashing')
          }}
        >
          Start
        </Button>
      </Centered>
    )
  }

  if (phase === 'flashing') {
    return (
      <main
        className="flex min-h-dvh flex-col justify-center px-5 sm:px-8"
        onClick={reducedMotion ? advance : undefined}
      >
        <ProgressBar
          value={groups.length === 0 ? 1 : (index + 1) / groups.length}
          className="fixed inset-x-0 top-0 h-1 rounded-none"
          label="チャンクの進捗"
        />
        <p className="reading-serif mx-auto max-w-2xl text-center text-2xl leading-relaxed sm:text-3xl">
          {current?.text}
        </p>
        {reducedMotion ? (
          <p className="mt-10 text-center text-xs text-fg-subtle">
            タップまたは Space キーで次へ
          </p>
        ) : null}
      </main>
    )
  }

  return (
    <Centered>
      <QuestionRunner
        questions={questions}
        title="意味が取れていたか"
        onComplete={(answers) => {
          const comprehension = scoreComprehension(questions, answers)
          onComplete({
            comprehensionScore: comprehension.score,
            questionCount: comprehension.total,
            level: chunkLevel,
          })
        }}
      />
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

