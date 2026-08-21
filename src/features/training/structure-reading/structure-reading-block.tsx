'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { structureProbeIndexes } from '@/core/training/question-set'
import { cn } from '@/lib/cn'
import type { TrainingBlockProps } from '../shared/types'

type Phase = 'intro' | 'paragraph' | 'answer'

/**
 * Training 04: Structure Reading（速読能力の中核）
 *
 * 段落を読み、「結局この段落は何を言っているのか」を選ばせる。
 * 正解を選べたかどうかではなく、段落単位で主張を取り出せるかを鍛える。
 *
 * 本文は全段落を読ませるが、設問は一部の段落だけに置く。
 * 段落ごとに毎回問うと、同じ教材を使う Comprehension / Immediate Recall と合わせて
 * 1本の教材に設問が集中し、読むより答える時間のほうが長くなるため。
 */
export function StructureReadingBlock({ passage, minutes, onComplete }: TrainingBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)

  const total = passage.paragraphs.length
  const probes = useMemo(() => new Set(structureProbeIndexes(total, minutes)), [minutes, total])

  const paragraph = passage.paragraphs[index]
  if (!paragraph) return null

  const asked = probes.has(index)

  const submit = (choiceId: string) => {
    setSelected(choiceId)
    const choice = paragraph.summaryChoices.find((c) => c.id === choiceId)
    if (choice?.correct) setCorrectCount(correctCount + 1)
    setPhase('answer')
  }

  const next = () => {
    setSelected(null)
    if (index + 1 >= total) {
      onComplete({
        comprehensionScore:
          probes.size === 0 ? null : Math.round((correctCount / probes.size) * 100),
        questionCount: probes.size,
      })
      return
    }
    setIndex(index + 1)
    setPhase('paragraph')
  }

  if (phase === 'intro') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          Structure Reading
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{passage.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          段落をひとつずつ読み、ところどころで「結局この段落は何を言っているのか」を選びます。
          全 {total} 段落・設問は {probes.size} 問。細部ではなく、段落の役割を掴んでください。
        </p>
        <Button size="lg" className="mt-8 w-full sm:w-auto" onClick={() => setPhase('paragraph')}>
          Start
        </Button>
      </Centered>
    )
  }

  const answered = phase === 'answer'

  return (
    <Centered>
      <p className="tabular text-xs text-fg-muted">
        段落 {index + 1} / {total}
      </p>

      <div className="reading-body reading-serif mt-4 max-w-none rounded-2xl border border-border bg-surface p-5 text-base sm:p-6">
        {paragraph.text}
      </div>

      {asked ? (
        <>
          <h2 className="mt-6 text-base font-medium">結局この段落は何を言っている？</h2>

          <ul className="mt-4 space-y-2">
            {paragraph.summaryChoices.map((choice) => {
              const isSelected = selected === choice.id
              const reveal = answered && (choice.correct || isSelected)
              return (
                <li key={choice.id}>
                  <button
                    type="button"
                    disabled={answered}
                    onClick={() => submit(choice.id)}
                    className={cn(
                      'w-full rounded-xl border px-4 py-4 text-left text-sm leading-relaxed transition-colors',
                      !answered && 'border-border hover:bg-surface-muted',
                      reveal && choice.correct && 'border-positive bg-surface',
                      reveal && !choice.correct && isSelected && 'border-negative bg-surface',
                      answered && !reveal && 'border-border opacity-50',
                    )}
                  >
                    <span>{choice.text}</span>
                    {reveal ? (
                      <span
                        className={cn(
                          'mt-1 block text-xs font-medium',
                          choice.correct ? 'text-positive' : 'text-negative',
                        )}
                      >
                        {choice.correct ? '正解' : 'あなたの回答'}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}

      {!asked || answered ? (
        <Button size="lg" className="mt-6 w-full sm:w-auto" onClick={next}>
          {index + 1 >= total ? '結果へ' : '次の段落へ'}
        </Button>
      ) : null}
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
