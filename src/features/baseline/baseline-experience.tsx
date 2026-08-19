'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  baselineFlowReducer,
  initialBaselineFlowState,
  selectedChoiceFor,
} from '@/core/session/baseline-flow'
import { scoreComprehension } from '@/core/metrics/comprehension'
import { calculateCpm } from '@/core/metrics/cpm'
import { initialTargetCpm } from '@/core/metrics/cpm'
import type { TrainingPassage } from '@/core/types'
import { getRepository, resolveTimezone } from '@/data/repositories'
import { ReadingSurface } from '@/features/training/shared/reading-surface'
import { TrainingHud } from '@/features/training/shared/training-hud'
import { useReadingTimer } from '@/features/training/shared/use-reading-timer'
import { BaselineResult } from './baseline-result'
import { QuestionCard } from './question-card'
import { RecallInput, RecallScore } from './recall-step'
import { saveBaselineResult, type BaselineOutcome } from './save-baseline'

export function BaselineExperience({ passage }: { passage: TrainingPassage }) {
  const [state, dispatch] = useReducer(baselineFlowReducer, initialBaselineFlowState)
  const timer = useReadingTimer()

  const [measurement, setMeasurement] = useState<{
    elapsedSeconds: number
    pauseCount: number
  } | null>(null)
  const [outcome, setOutcome] = useState<BaselineOutcome | null>(null)
  const startedAtRef = useRef<Date | null>(null)
  const savedRef = useRef(false)

  const questions = passage.questions
  const question = questions[state.questionIndex]

  // 結果画面に入った時点で一度だけ保存する
  useEffect(() => {
    if (state.phase !== 'result' || savedRef.current) return
    if (!measurement || state.recallScore === null) return
    savedRef.current = true

    const comprehension = scoreComprehension(questions, state.answers)
    void saveBaselineResult(getRepository(), {
      passage,
      elapsedSeconds: measurement.elapsedSeconds,
      pauseCount: measurement.pauseCount,
      comprehensionScore: comprehension.score,
      recallScore: state.recallScore,
      recallText: state.recallText,
      startedAt: startedAtRef.current ?? new Date(),
      finishedAt: new Date(),
      timezone: resolveTimezone(),
    }).then(setOutcome)
  }, [state, measurement, passage, questions])

  if (state.phase === 'ready') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          Baseline Test
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{passage.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          全 {passage.characterCount} 文字です。Start を押すと計測が始まります。
          普段どおりの速さで読み、読み終えたら Finished を押してください。
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

  if (state.phase === 'recall_score') {
    return (
      <Centered>
        <RecallScore
          recallText={state.recallText}
          keyPoints={passage.keyPoints}
          score={state.recallScore}
          onSelect={(score) => dispatch({ type: 'set_recall_score', score })}
          onSubmit={() => dispatch({ type: 'submit_recall_score' })}
        />
      </Centered>
    )
  }

  // result
  const fallback = buildOutcome(passage, state, measurement)
  return (
    <Centered>
      <BaselineResult {...(outcome ?? fallback)} />
    </Centered>
  )
}

/** 保存の完了を待たずに結果を出せるよう、同じ値をクライアント側でも算出する。 */
function buildOutcome(
  passage: TrainingPassage,
  state: { answers: { questionId: string; selectedChoiceId: string | null }[]; recallScore: number | null },
  measurement: { elapsedSeconds: number } | null,
): BaselineOutcome {
  const { cpm, valid, invalidReason } = calculateCpm({
    characterCount: passage.characterCount,
    elapsedSeconds: measurement?.elapsedSeconds ?? 0,
  })
  return {
    cpm,
    valid,
    invalidReason,
    comprehensionScore: scoreComprehension(passage.questions, state.answers).score,
    recallScore: state.recallScore ?? 0,
    targetCpm: initialTargetCpm(cpm),
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      {children}
    </main>
  )
}
