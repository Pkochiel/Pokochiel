import { describe, expect, it } from 'vitest'
import { RECALL } from '../config/training-config'
import { toLocalDate } from '../types/common'
import { isRecallDue, isRecallExpired, planRecallTasks } from './recall-schedule'

const d = (value: string) => toLocalDate(value)

describe('planRecallTasks', () => {
  const base = { passageId: 'gen-006', sourceSessionId: 'session-1' }

  it('翌日のタスクを作る', () => {
    const [task] = planRecallTasks({ ...base, completedOn: d('2026-08-19') })
    expect(task?.scheduledDate).toBe('2026-08-20')
  })

  it('設定された間隔ぶんのタスクを作る', () => {
    const tasks = planRecallTasks({ ...base, completedOn: d('2026-08-19') })
    expect(tasks).toHaveLength(RECALL.intervalsDays.length)
  })

  it('予定日から windowDays 後を期限にする', () => {
    const [task] = planRecallTasks({ ...base, completedOn: d('2026-08-19') })
    expect(task?.expiresOn).toBe('2026-08-23')
  })

  it('月をまたぐ日付でも正しい', () => {
    const [task] = planRecallTasks({ ...base, completedOn: d('2026-08-31') })
    expect(task?.scheduledDate).toBe('2026-09-01')
  })

  it('年をまたぐ日付でも正しい', () => {
    const [task] = planRecallTasks({ ...base, completedOn: d('2026-12-31') })
    expect(task?.scheduledDate).toBe('2027-01-01')
    expect(task?.expiresOn).toBe('2027-01-04')
  })

  it('教材とセッションを引き継ぐ', () => {
    const [task] = planRecallTasks({ ...base, completedOn: d('2026-08-19') })
    expect(task?.passageId).toBe('gen-006')
    expect(task?.sourceSessionId).toBe('session-1')
  })
})

describe('isRecallDue', () => {
  const task = { scheduledDate: d('2026-08-20'), expiresOn: d('2026-08-23') }

  it('予定日より前は対象外', () => {
    expect(isRecallDue(task, d('2026-08-19'))).toBe(false)
  })

  it('予定日当日は対象', () => {
    expect(isRecallDue(task, d('2026-08-20'))).toBe(true)
  })

  it('期限当日までは対象', () => {
    expect(isRecallDue(task, d('2026-08-23'))).toBe(true)
  })

  it('期限を過ぎたら対象外', () => {
    expect(isRecallDue(task, d('2026-08-24'))).toBe(false)
  })
})

describe('isRecallExpired', () => {
  it('期限内は false、超過は true', () => {
    const task = { expiresOn: d('2026-08-23') }
    expect(isRecallExpired(task, d('2026-08-23'))).toBe(false)
    expect(isRecallExpired(task, d('2026-08-24'))).toBe(true)
  })
})
