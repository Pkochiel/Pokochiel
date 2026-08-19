'use client'

import { useState } from 'react'
import { evaluateRecall } from '@/core/metrics/recall'
import { RecallInput, RecallReview } from '@/features/baseline/recall-step'
import type { TrainingBlockProps } from '../shared/types'

/**
 * Training 09: Immediate Recall
 *
 * 鍛えるのは「直後に、手がかりなしで内容を取り出せるか」。
 * 本文を完全に隠し、再現を書かせたうえで、Key Points との照合でスコアを出す。
 * 自己評価は補助指標として併せて記録する。
 */
export function ImmediateRecallBlock({ passage, onComplete }: TrainingBlockProps) {
  const [text, setText] = useState('')
  const [committed, setCommitted] = useState(false)
  const [recalledIndexes, setRecalledIndexes] = useState<number[]>([])
  const [selfAssessment, setSelfAssessment] = useState<number | null>(null)

  const toggle = (index: number) =>
    setRecalledIndexes((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index].sort(),
    )

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
        <RecallReview
          recallText={text}
          keyPoints={passage.keyPoints}
          recalledIndexes={recalledIndexes}
          onToggleKeyPoint={toggle}
          selfAssessment={selfAssessment}
          onSelfAssess={setSelfAssessment}
          onSubmit={() => {
            if (selfAssessment === null) return
            const recall = evaluateRecall({
              keyPoints: passage.keyPoints,
              recalledKeyPointIndexes: recalledIndexes,
              selfAssessment,
              text,
            })
            onComplete({
              immediateRecallScore: recall.score,
              recallText: text,
              accuracyScore: recall.score,
            })
          }}
        />
      )}
    </main>
  )
}
