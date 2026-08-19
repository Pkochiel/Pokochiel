'use client'

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  baselineFlowReducer,
  initialBaselineFlowState,
  selectedChoiceFor,
} from '@/core/session/baseline-flow'
import { scoreComprehension } from '@/core/metrics/comprehension'
import { calculateCpm, initialTargetCpm } from '@/core/metrics/cpm'
import { computeBaselineProfile } from '@/core/metrics/baseline-profile'
import { evaluateRecall } from '@/core/metrics/recall'
import type { TrainingPassage } from '@/core/types'
import { selectBaselinePassage } from '@/data/content'
import { getRepository, resolveTimezone } from '@/data/repositories'
import { ReadingSurface } from '@/features/training/shared/reading-surface'
import { TrainingHud } from '@/features/training/shared/training-hud'
import { useReadingTimer } from '@/features/training/shared/use-reading-timer'
import { BaselineResult } from './baseline-result'
import { QuestionCard } from './question-card'
import { RecallInput, RecallReview } from './recall-step'
import { saveBaselineResult, type BaselineOutcome } from './save-baseline'

/**
 * Baseline Test。
 *
 * 教材は毎回ローテーションする。同じ文章を繰り返すと、2回目以降は
 * 内容の記憶が効いてしまい、読書速度でも理解度でもない何かを測ることになる。
 */
export function BaselineExperience() {
  const [state, dispatch] = useReducer(baselineFlowReducer, initialBaselineFlowState)
  const timer = useReadingTimer()

  const [passage, setPassage] = useState<TrainingPassage | null>(null)
  const [attemptNumber, setAttemptNumber] = useState(1)
  const [measurement, setMeasurement] = useState<{
    elapsedSeconds: number
    pauseCount: number
  } | null>(null)
  const [outcome, setOutcome] = useState<BaselineOutcome | null>(null)
  const startedAtRef = useRef<Date | null>(null)
  const savedRef = useRef(false)

  // 使用済みの教材を避けて選ぶ
  useEffect(() => {
    let cancelled = false
    async function load() {
      const repository = getRepository()
      const [profile, tests] = await Promise.all([
        repository.getProfile(),
        repository.listReadingTests(),
      ])
      if (cancelled) return
      setPassage(selectBaselinePassage(profile?.usedBaselinePassageIds ?? []))
      setAttemptNumber(computeBaselineProfile(tests).attempts + 1)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const questions = useMemo(() => passage?.questions ?? [], [passage])
  const question = questions[state.questionIndex]

  // 結果画面に入った時点で一度だけ保存する
  useEffect(() => {
    if (state.phase !== 'result' || savedRef.current || !passage) return
    if (!measurement || state.selfAssessment === null) return
    savedRef.current = true

    const comprehension = scoreComprehension(questions, state.answers)
    const recall = evaluateRecall({
      keyPoints: passage.keyPoints,
      recalledKeyPointIndexes: state.recalledKeyPointIndexes,
      selfAssessment: state.selfAssessment,
      text: state.recallText,
    })

    void saveBaselineResult(getRepository(), {
      passage,
      elapsedSeconds: measurement.elapsedSeconds,
      pauseCount: measurement.pauseCount,
      comprehensionScore: comprehension.score,
      typeScores: comprehension.byType,
      recallScore: recall.score,
      recallText: state.recallText,
      startedAt: startedAtRef.current ?? new Date(),
      finishedAt: new Date(),
      timezone: resolveTimezone(),
    }).then(setOutcome)
  }, [state, measurement, passage, questions])

  if (!passage) {
    return (
      <Centered>
        <p className="text-sm text-fg-muted">測定用の文章を準備しています…</p>
      </Centered>
    )
  }

  if (state.phase === 'ready') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          Baseline Test{attemptNumber > 1 ? `・${attemptNumber} 回目` : ''}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{passage.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          全 {passage.characterCount} 文字です。Start を押すと計測が始まります。
          普段どおりの速さで読み、読み終えたら Finished を押してください。
        </p>
        <p className="mt-2 text-xs text-fg-subtle">
          読了後に理解度テスト（{questions.length} 問）と、本文を見ない再現を行います。
          {attemptNumber > 1 ? '前回とは別の文章を出しています。' : ''}
        </p>
        <Button
          size="lg"
          className="mt-8 w-full sm:w-auto"
          onClick={() => {
            startedAtRef.current = new Date()
            timer.start()
            dispatch({ type: 'start_reading' })
          }}
        >
          Start
        </Button>
      </Centered>
    )
  }

  if (state.phase === 'reading') {
    return (
      <>
        {/* 計測中は速度を表示しない。数値を見ながら読むと読み方が変わるため。 */}
        <TrainingHud title="Baseline Reading" elapsedSeconds={timer.elapsedSeconds} />
        <main className="mx-auto max-w-3xl px-5 pt-24 pb-32 sm:px-8">
          <ReadingSurface paragraphs={passage.paragraphs} serif />
        </main>
        <div className="fixed inset-x-0 bottom-0 bg-reading-bg/90 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-3xl justify-end">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => {
                setMeasurement(timer.finish())
                dispatch({ type: 'finish_reading' })
              }}
            >
              Finished
            </Button>
          </div>
        </div>
      </>
    )
  }

  if (state.phase === 'questions' && question) {
    return (
      <Centered>
        <QuestionCard
          question={question}
          index={state.questionIndex}
          total={questions.length}
          selectedChoiceId={selectedChoiceFor(state, question.id)}
          canGoBack={state.questionIndex > 0}
          onBack={() => dispatch({ type: 'back_question' })}
          onSelect={(choiceId) =>
            dispatch({
              type: 'answer',
              questionId: question.id,
              choiceId,
              totalQuestions: questions.length,
            })
          }
        />
      </Centered>
    )
  }

  if (state.phase === 'recall_input') {
    return (
      <Centered>
        <RecallInput
          value={state.recallText}
          onChange={(text) => dispatch({ type: 'set_recall_text', text })}
          onSubmit={() => dispatch({ type: 'submit_recall_text' })}
        />
      </Centered>
    )
  }

  if (state.phase === 'recall_review') {
    return (
      <Centered>
        <RecallReview
          recallText={state.recallText}
          keyPoints={passage.keyPoints}
          recalledIndexes={state.recalledKeyPointIndexes}
          onToggleKeyPoint={(index) => dispatch({ type: 'toggle_key_point', index })}
          selfAssessment={state.selfAssessment}
          onSelfAssess={(score) => dispatch({ type: 'set_self_assessment', score })}
          onSubmit={() => dispatch({ type: 'submit_recall_review' })}
        />
      </Centered>
    )
  }

  return (
    <Centered>
      <BaselineResult {...(outcome ?? buildOutcome(passage, state, measurement))} />
    </Centered>
  )
}

/** 保存の完了を待たずに結果を出せるよう、同じ値をクライアント側でも算出する。 */
function buildOutcome(
  passage: TrainingPassage,
  state: {
    answers: { questionId: string; selectedChoiceId: string | null }[]
    recalledKeyPointIndexes: number[]
    selfAssessment: number | null
    recallText: string
  },
  measurement: { elapsedSeconds: number } | null,
): BaselineOutcome {
  const { cpm, valid, invalidReason } = calculateCpm({
    characterCount: passage.characterCount,
    elapsedSeconds: measurement?.elapsedSeconds ?? 0,
  })
  const comprehension = scoreComprehension(passage.questions, state.answers)
  const recall = evaluateRecall({
    keyPoints: passage.keyPoints,
    recalledKeyPointIndexes: state.recalledKeyPointIndexes,
    selfAssessment: state.selfAssessment,
    text: state.recallText,
  })
  return {
    cpm,
    valid,
    invalidReason,
    comprehensionScore: comprehension.score,
    recallScore: recall.score,
    targetCpm: initialTargetCpm(cpm),
    profile: {
      cpm: valid ? Math.round(cpm) : null,
      comprehension: comprehension.score,
      mainIdea: comprehension.byType.main_idea ?? null,
      causeEffect: comprehension.byType.cause_effect ?? null,
      structure: comprehension.byType.structure ?? null,
      immediateRecall: recall.score,
      attempts: valid ? 1 : 0,
      updatedAt: null,
    },
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      {children}
    </main>
  )
}
