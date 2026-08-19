'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ButtonLink } from '@/components/ui/button'
import { CHUNKING, MEANING_FLASH } from '@/core/config/training-config'
import { initialTargetCpm } from '@/core/metrics/cpm'
import { formatLocalDate } from '@/core/util/date'
import { ruleBasedFeedback, type FeedbackMessage } from '@/core/feedback/feedback'
import { computeSkillProfile } from '@/core/metrics/skill-profile'
import type { ChunkLevel, PlanBlock, TrainingPassage } from '@/core/types'
import { getPassageById, selectPassageForTraining } from '@/data/content'
import { getRepository, resolveTimezone } from '@/data/repositories'
import { WarmupBlock } from './warmup/warmup-block'
import { SpeedPushBlock } from './speed-push/speed-push-block'
import { ChunkReadingBlock } from './chunk-reading/chunk-reading-block'
import { MeaningFlashBlock } from './meaning-flash/meaning-flash-block'
import { PredictionBlock } from './prediction/prediction-block'
import { VariableSpeedBlock } from './variable-speed/variable-speed-block'
import { RegressionBlock } from './regression/regression-block'
import { StructureReadingBlock } from './structure-reading/structure-reading-block'
import { ComprehensionBlock } from './comprehension/comprehension-block'
import { ImmediateRecallBlock } from './immediate-recall/immediate-recall-block'
import { DelayedRecallBlock } from '../recall/delayed-recall-block'
import { BlockTransition } from './block-transition'
import { SessionResult, type SessionSummary } from './session-result'
import { useDailyPlan } from './use-daily-plan'
import { finishSession, type CompletedBlock } from './save-session'
import type { BlockOutcome, TrainingBlockProps } from './shared/types'
import { TRAINING_LABELS } from './shared/types'

const FALLBACK_CPM = 600

const BLOCK_COMPONENTS: Partial<
  Record<PlanBlock['type'], (props: TrainingBlockProps) => React.ReactNode>
> = {
  warmup: WarmupBlock,
  speed_push: SpeedPushBlock,
  chunk_reading: ChunkReadingBlock,
  meaning_flash: MeaningFlashBlock,
  prediction_reading: PredictionBlock,
  variable_speed: VariableSpeedBlock,
  regression_control: RegressionBlock,
  structure_reading: StructureReadingBlock,
  comprehension: ComprehensionBlock,
  immediate_recall: ImmediateRecallBlock,
}

/**
 * Daily Training のランナー。
 *
 * 生成済みのプランに沿ってブロックを順に実行し、各結果を保存する。
 * 速度・チャンクレベルの調整はセッション終了時にまとめて行う。
 */
export function DailyTraining() {
  const { loading, plan, profile } = useDailyPlan()
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState<CompletedBlock[]>([])
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [transition, setTransition] = useState<{
    completed: PlanBlock
    messages: FeedbackMessage[]
  } | null>(null)
  const sessionRef = useRef<{ id: string; startedAt: Date } | null>(null)
  const finishingRef = useRef(false)

  const targetCpm = profile?.targetCpm ?? initialTargetCpm(profile?.baselineCpm ?? FALLBACK_CPM)
  const chunkLevel: ChunkLevel = profile?.chunkLevel ?? CHUNKING.defaultLevel
  const meaningFlashLevel: ChunkLevel = profile?.meaningFlashLevel ?? MEANING_FLASH.defaultLevel

  // セッションはプランを開いた時点で1件だけ作る
  useEffect(() => {
    if (!plan || sessionRef.current) return
    const startedAt = new Date()
    const timezone = resolveTimezone()
    void getRepository()
      .createSession({
        sessionType: 'daily',
        startedAt: startedAt.toISOString(),
        localDate: formatLocalDate(startedAt, timezone),
      })
      .then((session) => {
        sessionRef.current = { id: session.id, startedAt }
      })
  }, [plan])

  const finalize = useCallback(
    async (blocks: CompletedBlock[]) => {
      if (finishingRef.current) return
      finishingRef.current = true

      const session = sessionRef.current
      const repository = getRepository()
      const finishedAt = new Date()
      const timezone = resolveTimezone()

      if (!session) {
        const emptyProfile = computeSkillProfile({
          results: [],
          recallTasks: [],
          baselineCpm: profile?.baselineCpm ?? null,
        })
        setSummary({
          cpm: null,
          comprehension: null,
          immediateRecall: null,
          nextTargetCpm: targetCpm,
          direction: 'hold',
          reason: '記録を保存できませんでした',
          blocksCompleted: blocks.length,
          skillProfile: emptyProfile,
          feedback: [
            { tone: 'neutral', text: '今回の結果は保存されていません。もう一度お試しください。' },
          ],
        })
        return
      }

      const previous = await repository.listResults()
      const result = await finishSession(repository, {
        sessionId: session.id,
        completed: blocks,
        baselineCpm: profile?.baselineCpm ?? FALLBACK_CPM,
        currentTargetCpm: targetCpm,
        currentChunkLevel: chunkLevel,
        currentMeaningFlashLevel: meaningFlashLevel,
        recentComprehension: previous.flatMap((r) =>
          r.comprehensionScore === null ? [] : [r.comprehensionScore],
        ),
        localDate: formatLocalDate(finishedAt, timezone),
        finishedAt,
        startedAt: session.startedAt,
      })

      const [results, recallTasks] = await Promise.all([
        repository.listResults(),
        repository.listRecallTasks(),
      ])
      const skillProfile = computeSkillProfile({
        results,
        recallTasks,
        baselineCpm: profile?.baselineCpm ?? null,
      })

      setSummary({
        cpm: result.cpm,
        comprehension: result.comprehension,
        immediateRecall: result.immediateRecall,
        nextTargetCpm: result.adaptation.targetCpm,
        direction: result.adaptation.direction,
        reason: result.adaptation.reason,
        blocksCompleted: blocks.length,
        skillProfile,
        feedback: ruleBasedFeedback.forSession({
          profile: skillProfile,
          cpm: result.cpm,
          comprehension: result.comprehension,
          immediateRecall: result.immediateRecall,
          previousCpm:
            previous.filter((r) => r.cpm !== null).slice(-2)[0]?.cpm ?? null,
          previousComprehension:
            previous.filter((r) => r.comprehensionScore !== null).slice(-2)[0]
              ?.comprehensionScore ?? null,
        }),
      })
    },
    [chunkLevel, meaningFlashLevel, profile?.baselineCpm, targetCpm],
  )

  const handleComplete = useCallback(
    (block: PlanBlock, outcome: BlockOutcome) => {
      const session = sessionRef.current
      if (session) {
        void getRepository().saveResult({
          sessionId: session.id,
          trainingType: block.type,
          passageId: block.passageId ?? null,
          cpm: outcome.cpm ?? null,
          targetCpm: outcome.targetCpm ?? null,
          comprehensionScore: outcome.comprehensionScore ?? null,
          immediateRecallScore: outcome.immediateRecallScore ?? null,
          level: outcome.level ?? null,
          accuracyScore: outcome.accuracyScore ?? null,
          exposureMs: outcome.exposureMs ?? null,
          pauseCount: outcome.pauseCount ?? null,
          backCount: outcome.backCount ?? null,
          valid: outcome.valid ?? true,
        })
      }

      const nextCompleted = [...completed, { block, outcome }]
      setCompleted(nextCompleted)

      void (async () => {
        // 直近の同種トレーニングと比べてフィードバックを作る
        const previous = await getRepository().listResults({ trainingType: block.type })
        const last = previous[previous.length - 1]
        setTransition({
          completed: block,
          messages: ruleBasedFeedback.forTraining({
            trainingType: block.type,
            cpm: outcome.cpm ?? null,
            targetCpm: outcome.targetCpm ?? null,
            comprehensionScore: outcome.comprehensionScore ?? null,
            accuracyScore: outcome.accuracyScore ?? null,
            immediateRecallScore: outcome.immediateRecallScore ?? null,
            previousCpm: last?.cpm ?? null,
            previousComprehension: last?.comprehensionScore ?? null,
          }),
        })
      })()
    },
    [completed],
  )

  const continueAfterTransition = useCallback(() => {
    setTransition(null)
    if (!plan || index + 1 >= plan.blocks.length) {
      void finalize(completed)
      return
    }
    setIndex(index + 1)
  }, [completed, finalize, index, plan])

  if (summary) return <SessionResult summary={summary} />

  if (transition && plan) {
    const currentIndex = plan.blocks.findIndex((b) => b.order === transition.completed.order)
    const next = plan.blocks[currentIndex + 1]
    return (
      <BlockTransition
        completed={transition.completed.type}
        next={next?.type ?? null}
        index={currentIndex + 1}
        total={plan.blocks.length}
        messages={transition.messages}
        onContinue={continueAfterTransition}
      />
    )
  }

  if (loading || !plan) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center px-5">
        <p className="text-sm text-fg-muted">今日のトレーニングを準備しています…</p>
      </main>
    )
  }

  const block = plan.blocks[index]
  if (!block) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16">
        <h1 className="text-xl font-semibold">今日のトレーニングは完了しています</h1>
        <ButtonLink href="/dashboard" className="mt-6 w-full sm:w-auto">
          Dashboard へ
        </ButtonLink>
      </main>
    )
  }

  if (block.type === 'delayed_recall') {
    return <DelayedRecallBlock onComplete={(outcome) => handleComplete(block, outcome)} />
  }

  const Component = BLOCK_COMPONENTS[block.type]
  const passage = resolvePassage(block)

  if (!Component || !passage) {
    // 未実装のトレーニングはスキップして先へ進める（セッションを止めない）
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16">
        <h1 className="text-xl font-semibold">{TRAINING_LABELS[block.type]}</h1>
        <p className="mt-3 text-sm text-fg-muted">このトレーニングは現在準備中です。</p>
        <button
          type="button"
          onClick={() => handleComplete(block, {})}
          className="mt-6 text-sm text-brand hover:underline"
        >
          次へ進む →
        </button>
      </main>
    )
  }

  return (
    <>
      <SessionProgress index={index} total={plan.blocks.length} label={TRAINING_LABELS[block.type]} />
      <Component
        key={block.order}
        passage={passage}
        targetCpm={block.targetCpm ?? targetCpm}
        chunkLevel={
          block.chunkLevel ?? (block.type === 'meaning_flash' ? meaningFlashLevel : chunkLevel)
        }
        minutes={block.minutes}
        onComplete={(outcome) => handleComplete(block, outcome)}
      />
    </>
  )
}

/**
 * プランが指す教材。見つからない場合は、そのトレーニングに対応できる教材で代替する
 * （Prediction や Variable Speed は、対応していない教材では成立しないため）。
 */
function resolvePassage(block: PlanBlock): TrainingPassage | null {
  if (block.passageId) {
    const passage = getPassageById(block.passageId)
    if (passage) return passage
  }
  return selectPassageForTraining(block.type, 3)
}

function SessionProgress({
  index,
  total,
  label,
}: {
  index: number
  total: number
  label: string
}) {
  return (
    <p className="pointer-events-none fixed inset-x-0 bottom-2 z-20 text-center text-[11px] text-fg-subtle">
      {label}・{index + 1} / {total}
    </p>
  )
}
