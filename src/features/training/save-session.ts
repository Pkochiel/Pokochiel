import { adaptSpeed, type AdaptSpeedResult } from '@/core/adaptive/speed'
import { adaptChunkLevel } from '@/core/chunking/segment'
import { planRecallTasks } from '@/core/scheduler/recall-schedule'
import type { ChunkLevel, LocalDate, PlanBlock } from '@/core/types'
import type { TrainingRepository } from '@/data/repositories'
import type { BlockOutcome } from './shared/types'

export interface CompletedBlock {
  block: PlanBlock
  outcome: BlockOutcome
}

export interface FinishSessionInput {
  sessionId: string
  completed: readonly CompletedBlock[]
  baselineCpm: number
  currentTargetCpm: number
  currentChunkLevel: ChunkLevel
  recentComprehension: readonly number[]
  localDate: LocalDate
  finishedAt: Date
  startedAt: Date
}

export interface FinishSessionResult {
  adaptation: AdaptSpeedResult
  chunkLevel: ChunkLevel
  cpm: number | null
  comprehension: number | null
  immediateRecall: number | null
}

const mean = (values: readonly number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length)

/**
 * セッション終了時の集計と保存。
 *
 * 速度の調整は「セッション全体の理解度」で行う。ブロック単位で上下させると
 * 設問数の少ない回に引きずられて乱高下するため。
 */
export async function finishSession(
  repository: TrainingRepository,
  input: FinishSessionInput,
): Promise<FinishSessionResult> {
  const outcomes = input.completed.map((c) => c.outcome)

  const cpm = mean(
    outcomes.flatMap((o) => (o.cpm != null && o.valid !== false ? [o.cpm] : [])),
  )
  const comprehensionValues = outcomes.flatMap((o) =>
    o.comprehensionScore != null ? [o.comprehensionScore] : [],
  )
  const comprehension = mean(comprehensionValues)
  const immediateRecall = mean(
    outcomes.flatMap((o) => (o.immediateRecallScore != null ? [o.immediateRecallScore] : [])),
  )
  const questionCount = outcomes.reduce((sum, o) => sum + (o.questionCount ?? 0), 0)

  // セッション全体の設問数で判定する。少なすぎる回では adaptSpeed 側が維持を選ぶ。
  const adaptation = adaptSpeed({
    currentTargetCpm: input.currentTargetCpm,
    baselineCpm: input.baselineCpm,
    recentComprehension: [
      ...input.recentComprehension,
      ...(comprehension === null ? [] : [comprehension]),
    ],
    questionCount,
  })

  const chunkOutcome = input.completed.find((c) => c.block.type === 'chunk_reading')?.outcome
  const chunkLevel =
    chunkOutcome?.comprehensionScore == null
      ? input.currentChunkLevel
      : adaptChunkLevel(input.currentChunkLevel, chunkOutcome.comprehensionScore / 100)

  await repository.completeSession(
    input.sessionId,
    input.finishedAt.toISOString(),
    Math.max(0, Math.round((input.finishedAt.getTime() - input.startedAt.getTime()) / 1000)),
  )

  await repository.saveProfile({ targetCpm: adaptation.targetCpm, chunkLevel })

  // 今日読んだ教材に翌日の Recall を予約する（重複は Repository 側で弾かれる）
  const recalledPassageIds = [
    ...new Set(
      input.completed
        .filter((c) => c.block.type === 'immediate_recall' || c.block.type === 'structure_reading')
        .flatMap((c) => (c.block.passageId ? [c.block.passageId] : [])),
    ),
  ]

  if (recalledPassageIds.length > 0) {
    await repository.scheduleRecallTasks(
      recalledPassageIds.flatMap((passageId) =>
        planRecallTasks({
          passageId,
          sourceSessionId: input.sessionId,
          completedOn: input.localDate,
        }),
      ),
    )
  }

  return { adaptation, chunkLevel, cpm, comprehension, immediateRecall }
}
