'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { scorePrediction, type PredictionAnswer } from '@/core/training/prediction'
import type { PassageParagraph, PredictionChoice } from '@/core/types'
import { cn } from '@/lib/cn'
import { ReadingSurface } from '../shared/reading-surface'
import type { TrainingBlockProps } from '../shared/types'

type Phase = 'intro' | 'reading' | 'predict' | 'reveal' | 'result'

const QUALITY_LABELS = {
  correct: '論理の方向も論点も合っていました',
  partial: '方向は合っていますが、実際の論点とはずれています',
  miss: '論理の方向が違っています',
} as const

/**
 * Training 05: Prediction Reading
 *
 * 鍛える能力：次の論理展開を予測しながら読む力（Prediction）。
 * 測り方：停止位置での予測が、実際の展開と論理方向・論点で合っていたかを採点する。
 *
 * 完全一致は求めない。方向が合っていれば部分点を与える。
 * 自由記述には加点するが、それは正確さではなく「言語化したこと」への加点である。
 */
export function PredictionBlock({ passage, onComplete }: TrainingBlockProps) {
  const stops = useMemo(
    () => passage.paragraphs.filter((p) => p.predictionStop?.choices?.length),
    [passage.paragraphs],
  )

  const [phase, setPhase] = useState<Phase>('intro')
  const [stopIndex, setStopIndex] = useState(0)
  const [selected, setSelected] = useState<PredictionChoice | null>(null)
  const [written, setWritten] = useState('')
  const [answers, setAnswers] = useState<PredictionAnswer[]>([])

  const stop: PassageParagraph | undefined = stops[stopIndex]
  const visibleParagraphs = stop
    ? passage.paragraphs.filter((p) => p.index <= stop.index)
    : passage.paragraphs

  if (stops.length === 0) {
    return (
      <Centered>
        <p className="text-sm text-fg-muted">この教材には予測の停止位置がありません。</p>
        <Button className="mt-6 w-full sm:w-auto" onClick={() => onComplete({})}>
          次へ進む
        </Button>
      </Centered>
    )
  }

  if (phase === 'intro') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          Prediction Reading
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{passage.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          途中で本文が止まります。そこで「次に何が説明されるか」を予測してから先へ進みます。
          当てることが目的ではなく、仮説を持って読む状態を作ることが目的です。
        </p>
        <Button size="lg" className="mt-8 w-full sm:w-auto" onClick={() => setPhase('reading')}>
          Start
        </Button>
      </Centered>
    )
  }

  if (phase === 'reading' && stop) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <p className="text-xs text-fg-subtle">
          停止位置 {stopIndex + 1} / {stops.length}
        </p>
        <div className="mt-6">
          <ReadingSurface paragraphs={visibleParagraphs} serif />
        </div>
        <div className="mt-8 rounded-2xl border border-dashed border-border p-5">
          <p className="text-sm text-fg-muted">ここで一旦停止します。</p>
          <Button className="mt-4 w-full sm:w-auto" onClick={() => setPhase('predict')}>
            予測する
          </Button>
        </div>
      </main>
    )
  }

  if (phase === 'predict' && stop?.predictionStop) {
    const choices = stop.predictionStop.choices ?? []
    return (
      <Centered>
        <p className="text-xs text-fg-subtle">
          停止位置 {stopIndex + 1} / {stops.length}
        </p>
        <h2 className="mt-4 text-lg leading-relaxed font-medium sm:text-xl">
          {stop.predictionStop.prompt}
        </h2>

        <ul className="mt-6 space-y-2">
          {choices.map((choice) => (
            <li key={choice.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(choice)
                  setPhase('reveal')
                  setAnswers((current) => [
                    ...current,
                    { quality: choice.quality, hasWrittenPrediction: written.trim().length > 0 },
                  ])
                }}
                className="w-full rounded-xl border border-border px-4 py-4 text-left text-sm leading-relaxed transition-colors hover:bg-surface-muted"
              >
                {choice.text}
              </button>
            </li>
          ))}
        </ul>

        <label className="mt-6 block">
          <span className="text-sm font-medium">自分の言葉でも書いてみる（任意）</span>
          <textarea
            value={written}
            onChange={(event) => setWritten(event.target.value)}
            rows={3}
            placeholder="例）この後は、なぜそうなるのかの理由が3つ挙げられると思う"
            className="mt-2 w-full resize-y rounded-xl border border-border bg-surface p-3 text-sm leading-relaxed"
          />
          <span className="mt-1 block text-xs text-fg-subtle">
            選択肢を選ぶ前に書くと、予測の練習になります。
          </span>
        </label>
      </Centered>
    )
  }

  if (phase === 'reveal' && stop?.predictionStop && selected) {
    const continuation = passage.paragraphs.filter(
      (p) => p.index > stop.index && p.index <= stop.index + 2,
    )
    const isLast = stopIndex + 1 >= stops.length
    return (
      <Centered>
        <p
          className={cn(
            'text-xs font-semibold tracking-wide uppercase',
            selected.quality === 'correct'
              ? 'text-positive'
              : selected.quality === 'partial'
                ? 'text-accent'
                : 'text-negative',
          )}
        >
          {QUALITY_LABELS[selected.quality]}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">{selected.explanation}</p>

        <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
            実際の続き
          </h3>
          <div className="mt-3">
            <ReadingSurface paragraphs={continuation} />
          </div>
        </section>

        {written.trim().length > 0 ? (
          <section className="mt-4 rounded-2xl border border-border bg-surface-muted p-5">
            <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
              あなたの予測
            </h3>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{written}</p>
          </section>
        ) : null}

        <Button
          size="lg"
          className="mt-6 w-full sm:w-auto"
          onClick={() => {
            setSelected(null)
            setWritten('')
            if (isLast) {
              setPhase('result')
              return
            }
            setStopIndex(stopIndex + 1)
            setPhase('reading')
          }}
        >
          {isLast ? '結果へ' : '次の停止位置へ'}
        </Button>
      </Centered>
    )
  }

  const score = scorePrediction(answers)
  return (
    <Centered>
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Prediction</p>
      <h2 className="mt-3 flex items-baseline gap-2 text-3xl font-semibold">
        <span className="tabular">{score.score}</span>
        <span className="text-sm font-normal text-fg-muted">/ 100</span>
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">
        論点まで当たった予測 {score.correct} 件、方向は合っていた予測 {score.partial} 件、
        外れ {score.miss} 件。方向が合っていれば、読み方としては機能しています。
      </p>
      <Button
        size="lg"
        className="mt-6 w-full sm:w-auto"
        onClick={() => onComplete({ accuracyScore: score.score, questionCount: score.total })}
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
