'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ButtonLink } from '@/components/ui/button'
import { Stat } from '@/components/ui/stat'
import { CHUNKING, MEANING_FLASH } from '@/core/config/training-config'
import { initialTargetCpm } from '@/core/metrics/cpm'
import { planRecallTasks } from '@/core/scheduler/recall-schedule'
import { formatLocalDate } from '@/core/util/date'
import type { ChunkLevel, Profile, TrainingPassage, TrainingType } from '@/core/types'
import { formatScore } from '@/lib/format'
import { selectPassageForTraining } from '@/data/content'
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
import type { BlockOutcome, TrainingBlockProps } from './shared/types'
import { TRAINING_LABELS } from './shared/types'

const FALLBACK_CPM = 600

const BLOCK_COMPONENTS: Partial<
  Record<TrainingType, (props: TrainingBlockProps) => React.ReactNode>
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
 * 単体トレーニング。日次の構成とは別に、1種類だけ実施する。
 * 結果は同じように保存し、読んだ教材には翌日の Recall を予約する。
 */
export function SingleTraining({ type }: { type: TrainingType }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [passage, setPassage] = useState<TrainingPassage | null>(null)
  const [outcome, setOutcome] = useState<BlockOutcome | null>(null)
  const usedIdsRef = useRef<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const repository = getRepository()
      const [loaded, results] = await Promise.all([
        repository.getProfile(),
        repository.listResults(),
      ])
      if (cancelled) return
      usedIdsRef.current = results.flatMap((r) => (r.passageId ? [r.passageId] : []))
      setProfile(loaded)
      setPassage(selectPassageForTraining(type, 3, { excludeIds: usedIdsRef.current.slice(-10) }))
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [type])

  const handleComplete = useCallback(
    async (result: BlockOutcome) => {
      setOutcome(result)
      if (!passage) return

      const repository = getRepository()
      const now = new Date()
      const localDate = formatLocalDate(now, resolveTimezone())

      const session = await repository.createSession({
        sessionType: 'single',
        startedAt: now.toISOString(),
        localDate,
      })
      await repository.saveResult({
        sessionId: session.id,
        trainingType: type,
        passageId: passage.id,
        cpm: result.cpm ?? null,
        targetCpm: result.targetCpm ?? null,
        comprehensionScore: result.comprehensionScore ?? null,
        immediateRecallScore: result.immediateRecallScore ?? null,
        level: result.level ?? null,
        accuracyScore: result.accuracyScore ?? null,
        exposureMs: result.exposureMs ?? null,
        pauseCount: result.pauseCount ?? null,
        valid: result.valid ?? true,
      })
      await repository.completeSession(session.id, new Date().toISOString(), 0)

      if (type === 'immediate_recall' || type === 'structure_reading') {
        await repository.scheduleRecallTasks(
          planRecallTasks({
            passageId: passage.id,
            sourceSessionId: session.id,
            completedOn: localDate,
          }),
        )
      }
    },
    [passage, type],
  )

  if (type === 'delayed_recall') return <DelayedRecallBlock />

  if (loading) {
    return (
      <Centered>
        <p className="text-sm text-fg-muted">準備しています…</p>
      </Centered>
    )
  }

  if (outcome) {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Result</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {TRAINING_LABELS[type]} が終わりました
        </h1>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {outcome.cpm != null ? (
            <Stat label="Reading Speed" value={formatScore(outcome.cpm)} unit="字/分" tone="brand" />
          ) : null}
          {outcome.comprehensionScore != null ? (
            <Stat label="Comprehension" value={formatScore(outcome.comprehensionScore, '%')} />
          ) : null}
          {outcome.immediateRecallScore != null ? (
            <Stat label="Recall" value={formatScore(outcome.immediateRecallScore, '%')} />
          ) : null}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/dashboard" size="lg">
            Dashboard へ
          </ButtonLink>
          <ButtonLink href="/training" size="lg" variant="secondary">
            今日の構成を実施する
          </ButtonLink>
        </div>
      </Centered>
    )
  }

  const Component = BLOCK_COMPONENTS[type]
  if (!Component || !passage) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">{TRAINING_LABELS[type]}</h1>
        <p className="mt-3 text-sm text-fg-muted">
          このトレーニングは今日の構成の中でのみ実施できます。
        </p>
        <ButtonLink href="/training" className="mt-6 w-full sm:w-auto">
          今日の構成へ
        </ButtonLink>
      </Centered>
    )
  }

  const targetCpm = profile?.targetCpm ?? initialTargetCpm(profile?.baselineCpm ?? FALLBACK_CPM)
  const chunkLevel: ChunkLevel =
    type === 'meaning_flash'
      ? (profile?.meaningFlashLevel ?? MEANING_FLASH.defaultLevel)
      : (profile?.chunkLevel ?? CHUNKING.defaultLevel)

  return (
    <Component
      passage={passage}
      targetCpm={targetCpm}
      chunkLevel={chunkLevel}
      minutes={5}
      onComplete={(result) => void handleComplete(result)}
    />
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      {children}
    </main>
  )
}
