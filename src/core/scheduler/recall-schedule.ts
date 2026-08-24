import { RECALL } from '../config/training-config'
import type { LocalDate } from '../types/common'
import { addDays, compareLocalDate } from '../util/date'

export interface PlannedRecallTask {
  passageId: string
  sourceSessionId: string | null
  scheduledDate: LocalDate
  expiresOn: LocalDate
}

export interface RecallScheduleInput {
  passageId: string
  sourceSessionId: string | null
  /** 読んだ日（ユーザーのタイムゾーンにおける暦日） */
  completedOn: LocalDate
}

/**
 * 読んだ教材に対する想起タスクを作る。
 *
 * MVP は翌日のみ（RECALL.intervalsDays = [1]）。
 * 将来 [1, 3, 7] に広げても、この関数の戻り値が増えるだけで呼び出し側は変わらない。
 */
export function planRecallTasks({
  passageId,
  sourceSessionId,
  completedOn,
}: RecallScheduleInput): PlannedRecallTask[] {
  return RECALL.intervalsDays.map((days) => {
    const scheduledDate = addDays(completedOn, days)
    return {
      passageId,
      sourceSessionId,
      scheduledDate,
      expiresOn: addDays(scheduledDate, RECALL.windowDays),
    }
  })
}

/**
 * 実施可能かどうか。
 * 期限を過ぎた想起は長期記憶の指標として扱わない（遅れて答えた結果を混ぜない）。
 */
export function isRecallDue(
  task: Pick<PlannedRecallTask, 'scheduledDate' | 'expiresOn'>,
  today: LocalDate,
): boolean {
  return (
    compareLocalDate(task.scheduledDate, today) <= 0 && compareLocalDate(task.expiresOn, today) >= 0
  )
}

/** 期限切れかどうか。 */
export function isRecallExpired(
  task: Pick<PlannedRecallTask, 'expiresOn'>,
  today: LocalDate,
): boolean {
  return compareLocalDate(task.expiresOn, today) < 0
}
