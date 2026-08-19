import { calculateCpm, initialTargetCpm, type CpmInvalidReason } from '@/core/metrics/cpm'
import { planRecallTasks } from '@/core/scheduler/recall-schedule'
import { formatLocalDate } from '@/core/util/date'
import type { TrainingPassage } from '@/core/types'
import type { TrainingRepository } from '@/data/repositories'

export interface BaselineSubmission {
  passage: TrainingPassage
  elapsedSeconds: number
  pauseCount: number
  comprehensionScore: number | null
  recallScore: number
  recallText: string
  startedAt: Date
  finishedAt: Date
  timezone: string
}

export interface BaselineOutcome {
  cpm: number
  valid: boolean
  invalidReason: CpmInvalidReason | null
  comprehensionScore: number | null
  recallScore: number
  targetCpm: number
}

/**
 * Baseline の結果を保存する。
 *
 * - 計測が無効（短すぎる・速すぎる）な場合は baselineCpm を書き換えない。
 *   ここで壊れた値を基準にすると、以降の速度適応がすべて狂う。
 * - 読んだ教材には翌日の Recall を予約する。初日から長期記憶の測定を始める。
 */
export async function saveBaselineResult(
  repository: TrainingRepository,
  submission: BaselineSubmission,
): Promise<BaselineOutcome> {
  const { passage, elapsedSeconds, timezone } = submission
  const localDate = formatLocalDate(submission.finishedAt, timezone)
  const { cpm, valid, invalidReason } = calculateCpm({
    characterCount: passage.characterCount,
    elapsedSeconds,
  })

  const session = await repository.createSession({
    sessionType: 'baseline',
    startedAt: submission.startedAt.toISOString(),
    localDate,
  })

  await repository.completeSession(
    session.id,
    submission.finishedAt.toISOString(),
    Math.round((submission.finishedAt.getTime() - submission.startedAt.getTime()) / 1000),
  )

  await repository.saveReadingTest({
    sessionId: session.id,
    passageId: passage.id,
    isBaseline: true,
    elapsedSeconds,
    characterCount: passage.characterCount,
    cpm,
    comprehensionScore: submission.comprehensionScore,
    recallScore: submission.recallScore,
    recallText: submission.recallText,
  })

  const targetCpm = initialTargetCpm(cpm)

  await repository.saveProfile({
    ...(valid ? { baselineCpm: Math.round(cpm), targetCpm } : {}),
    onboardedAt: submission.finishedAt.toISOString(),
    timezone,
  })

  await repository.scheduleRecallTasks(
    planRecallTasks({
      passageId: passage.id,
      sourceSessionId: session.id,
      completedOn: localDate,
    }),
  )

  return {
    cpm,
    valid,
    invalidReason,
    comprehensionScore: submission.comprehensionScore,
    recallScore: submission.recallScore,
    targetCpm,
  }
}
