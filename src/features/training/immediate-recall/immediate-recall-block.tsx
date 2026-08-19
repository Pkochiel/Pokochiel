'use client'

import { useState } from 'react'
import { RecallInput, RecallScore } from '@/features/baseline/recall-step'
import type { TrainingBlockProps } from '../shared/types'

/**
 * Training 09: Immediate Recall
 *
 * 本文を完全に隠し、内容を3〜5項目で再現させる。
 * Key Points は入力を確定した後にだけ表示する（自己評価の水増しを防ぐ）。
 * MVP では自己評価。将来 LLM による意味的一致度の評価に置き換える。
 */
export function ImmediateRecallBlock({ passage, onComplete }: TrainingBlockProps) {
  const [text, setText] = useState('')
  const [committed, setCommitted] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      {!committed ? (
        <RecallInput
          value={text}
          onChange={setText}
          onSubmit={() => {
            if (text.trim().length === 0) return
            setCommitted(true)
          }}
        />
      ) : (
        <RecallScore
          recallText={text}
          keyPoints={passage.keyPoints}
          score={score}
          onSelect={setScore}
          onSubmit={() => {
            if (score === null) return
            onComplete({ immediateRecallScore: score, recallText: text })
          }}
        />
      )}
    </main>
  )
}
