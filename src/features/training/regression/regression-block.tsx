'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { calculateCpm } from '@/core/metrics/cpm'
import { scoreComprehension } from '@/core/metrics/comprehension'
import {
  backPerKiloChars,
  evaluateRegression,
  type RegressionEvaluation,
} from '@/core/training/regression'
import { readCheckQuestions } from '@/core/training/question-set'
import { getPassageById } from '@/data/content'
import { getRepository } from '@/data/repositories'
import { PacedText } from '../shared/paced-text'
import { QuestionRunner } from '../shared/question-runner'
import { TrainingHud } from '../shared/training-hud'
import { usePacer } from '../shared/use-pacer'
import type { TrainingBlockProps } from '../shared/types'

/** 1回の読み戻しで戻る文字数。段落1つぶんに相当する量を目安にする。 */
const REWIND_CHARS = 80

type Phase = 'intro' | 'reading' | 'questions' | 'result'

interface Measurement {
  elapsedSeconds: number
  pauseCount: number
  backCount: number
}

/**
 * Training 07: Regression Control
 *
 * 鍛える能力：無意識の不要な読み戻りを減らすこと。
 * 測り方：読み戻り回数そのものではなく、読み戻りの密度と理解度の関係で評価する。
 *
 * 読み戻しは禁止しない。必要だと判断したときは戻れる。
 * 読み戻りが減っても理解度が大きく落ちていれば「速度過剰」と判定する。
 */
export function RegressionBlock({
  passage,
  targetCpm,
  minutes,
  onComplete,
}: TrainingBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [measurement, setMeasurement] = useState<Measurement | null>(null)
  const [evaluation, setEvaluation] = useState<RegressionEvaluation | null>(null)
  const [comprehensionScore, setComprehensionScore] = useState<number | null>(null)

  const questions = useMemo(
    () => readCheckQuestions(passage.questions, minutes),
    [minutes, passage.questions],
  )

  const handleReachEnd = useCallback((result: Measurement) => {
    setMeasurement(result)
    setPhase('questions')
  }, [])

  const pacer = usePacer({
    targetCpm,
    totalCharacters: passage.characterCount,
    onReachEnd: handleReachEnd,
  })

  useEffect(() => {
    if (phase !== 'reading') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        pacer.goBack(REWIND_CHARS)
      }
      if (event.code === 'Space') {
        event.preventDefault()
        pacer.toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, pacer])

  if (phase === 'intro') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          Regression Control
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{passage.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          ハイライトが一定の速度で進みます。戻ることは禁止しません。
          必要だと感じたときは「戻る」を押してください。回数だけを記録します。
        </p>
        <p className="mt-2 text-xs text-fg-subtle">
          目的は戻らないことではなく、無意識の戻りを減らすことです。読了後に理解度も測ります。
        </p>
        <Button
          size="lg"
          className="mt-8 w-full sm:w-auto"
          onClick={() => {
            pacer.start()
            setPhase('reading')
          }}
        >
          Start
        </Button>
      </Centered>
    )
  }

  if (phase === 'reading') {
    return (
      <>
        <TrainingHud
          title="Regression Control"
          elapsedSeconds={pacer.elapsedSeconds}
          cpm={targetCpm}
          progress={pacer.progress}
        />
        <main className="mx-auto max-w-3xl px-5 pt-24 pb-32 sm:px-8">
          <PacedText paragraphs={passage.paragraphs} position={pacer.position} />
        </main>
        <div className="fixed inset-x-0 bottom-0 bg-reading-bg/90 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => pacer.goBack(REWIND_CHARS)}>
                戻る
              </Button>
              <Button variant="ghost" onClick={pacer.toggle}>
                {pacer.status === 'paused' ? '再開' : '一時停止'}
              </Button>
              <span className="tabular text-xs text-fg-subtle">戻り {pacer.backCount} 回</span>
            </div>
            <Button
              onClick={() => {
                setMeasurement(pacer.finish())
                setPhase('questions')
              }}
            >
              読み終えた
            </Button>
          </div>
        </div>
      </>
    )
  }

  if (phase === 'questions') {
    return (
      <Centered>
        <QuestionRunner
          questions={questions}
          title="理解度チェック"
          onComplete={(answers) => {
            const comprehension = scoreComprehension(questions, answers)
            setComprehensionScore(comprehension.score)
            void (async () => {
              // 前回の同種トレーニングと比較して評価する
              const previous = await getRepository().listResults({
                trainingType: 'regression_control',
              })
              const last = previous[previous.length - 1]
              // 前回の密度は、前回読んだ教材の文字数で割って求める
              const previousChars = last?.passageId
                ? (getPassageById(last.passageId)?.characterCount ?? null)
                : null
              const previousDensity =
                last?.backCount != null && previousChars
                  ? backPerKiloChars(last.backCount, previousChars)
                  : null

              setEvaluation(
                evaluateRegression({
                  backCount: measurement?.backCount ?? 0,
                  pauseCount: measurement?.pauseCount ?? 0,
                  characterCount: passage.characterCount,
                  comprehensionScore: comprehension.score,
                  previousBackPerKiloChars: previousDensity,
                  previousComprehension: last?.comprehensionScore ?? null,
                }),
              )
              setPhase('result')
            })()
          }}
        />
      </Centered>
    )
  }

  const { cpm, valid } = calculateCpm({
    characterCount: passage.characterCount,
    elapsedSeconds: measurement?.elapsedSeconds ?? 0,
  })

  return (
    <Centered>
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
        Regression Control
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">読み戻りの記録</h2>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="戻り" value={`${measurement?.backCount ?? 0} 回`} />
        <Metric label="一時停止" value={`${measurement?.pauseCount ?? 0} 回`} />
        <Metric label="速度" value={`${Math.round(cpm)} 字/分`} />
        <Metric label="理解度" value={comprehensionScore === null ? '—' : `${comprehensionScore}%`} />
      </dl>

      <p className="mt-5 rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-fg-muted">
        {evaluation?.message ?? '記録しました。'}
      </p>
      <p className="mt-2 text-xs text-fg-subtle">
        読み戻りの回数だけでは良し悪しを判断しません。理解度と併せて見ています。
      </p>

      <Button
        size="lg"
        className="mt-6 w-full sm:w-auto"
        onClick={() =>
          onComplete({
            cpm,
            targetCpm,
            valid,
            comprehensionScore,
            questionCount: questions.length,
            backCount: measurement?.backCount ?? 0,
            pauseCount: measurement?.pauseCount ?? 0,
          })
        }
      >
        次へ
      </Button>
    </Centered>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="tabular mt-1 text-lg font-semibold">{value}</dd>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      {children}
    </main>
  )
}
