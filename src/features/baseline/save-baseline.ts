import { calculateCpm, initialTargetCpm, type CpmInvalidReason } from '@/core/metrics/cpm'
import { computeBaselineProfile } from '@/core/metrics/baseline-profile'
import { planRecallTasks } from '@/core/scheduler/recall-schedule'
import { formatLocalDate } from '@/core/util/date'
import type { BaselineProfile, QuestionType, TrainingPassage } from '@/core/types'
import type { TrainingRepository } from '@/data/repositories'

export interface BaselineSubmission {
  passage: TrainingPassage
  elapsedSeconds: number
  pauseCount: number
  comprehensionScore: number | null
  /** 設問タイプ別の正答率。Baseline Profile の内訳になる */
  typeScores: Partial<Record<QuestionType, number>>
  /** Key Point の照合による想起スコア */
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
  /** 複数回の測定をまとめた現在地 */
  profile: BaselineProfile
}

/**
 * Baseline の結果を保存する。
 *
 * - 無効な計測（短すぎる・速すぎる）では基準値を書き換えない
 * - 基準値は毎回上書きではなく、有効な測定すべてから作り直す（CPM は中央値）
 * - 使用した教材を記録し、再測定では別の文章を出す
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
    typeScores: submission.typeScores,
  })

  // 保存済みの全測定から作り直す（1回の外れ値に引きずられないようにする）
  const profile = computeBaselineProfile(await repository.listReadingTests())
  const existing = await repository.getProfile()
  const usedIds = [...new Set([...(existing?.usedBaselinePassageIds ?? []), passage.id])]
  const baselineCpm = profile.cpm ?? Math.round(cpm)
  const targetCpm = initialTargetCpm(baselineCpm)

  await repository.saveProfile({
    ...(profile.attempts > 0 ? { baselineCpm, targetCpm, baselineProfile: profile } : {}),
    usedBaselinePassageIds: usedIds,
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
    profile,
  }
}
