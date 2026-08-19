import { beforeEach, describe, expect, it } from 'vitest'
import { toLocalDate } from '@/core/types'
import { LocalStorageRepository } from './local-storage'
import { MemoryStorage } from './storage'

const d = (value: string) => toLocalDate(value)

function createRepository(storage = new MemoryStorage()) {
  let counter = 0
  let clock = new Date('2026-08-19T09:00:00Z')
  const repo = new LocalStorageRepository({
    storage,
    now: () => clock,
    createId: () => `id-${++counter}`,
    defaultTimezone: 'Asia/Tokyo',
  })
  return {
    repo,
    storage,
    setNow: (iso: string) => {
      clock = new Date(iso)
    },
  }
}

describe('LocalStorageRepository: profile', () => {
  it('未保存なら null を返す', async () => {
    const { repo } = createRepository()
    expect(await repo.getProfile()).toBeNull()
  })

  it('保存した内容を読み出せる', async () => {
    const { repo } = createRepository()
    await repo.saveProfile({ displayName: 'テスト', baselineCpm: 600, targetCpm: 690 })
    const profile = await repo.getProfile()
    expect(profile?.baselineCpm).toBe(600)
    expect(profile?.targetCpm).toBe(690)
    expect(profile?.preferredDurationMinutes).toBe(30)
  })

  it('部分更新で既存の値を消さない', async () => {
    const { repo } = createRepository()
    await repo.saveProfile({ baselineCpm: 600, displayName: '初期' })
    await repo.saveProfile({ targetCpm: 700 })
    const profile = await repo.getProfile()
    expect(profile?.baselineCpm).toBe(600)
    expect(profile?.displayName).toBe('初期')
    expect(profile?.targetCpm).toBe(700)
  })

  it('createdAt を保持し updatedAt を更新する', async () => {
    const { repo, setNow } = createRepository()
    const first = await repo.saveProfile({ baselineCpm: 600 })
    setNow('2026-08-20T09:00:00Z')
    const second = await repo.saveProfile({ baselineCpm: 650 })
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt).not.toBe(first.updatedAt)
  })

  it('壊れたデータを読んでも落ちず、初期状態として扱う', async () => {
    const storage = new MemoryStorage()
    storage.setItem('srl:v1:profile', '{ this is not json')
    const { repo } = createRepository(storage)
    expect(await repo.getProfile()).toBeNull()
  })

  it('スキーマに合わないデータは破棄する', async () => {
    const storage = new MemoryStorage()
    storage.setItem('srl:v1:profile', JSON.stringify({ id: 'x', baselineCpm: 'fast' }))
    const { repo } = createRepository(storage)
    expect(await repo.getProfile()).toBeNull()
  })
})

describe('LocalStorageRepository: sessions と results', () => {
  it('セッションを作成し完了できる', async () => {
    const { repo } = createRepository()
    const session = await repo.createSession({
      sessionType: 'baseline',
      startedAt: '2026-08-19T09:00:00Z',
      localDate: d('2026-08-19'),
    })
    expect(session.completedAt).toBeNull()

    await repo.completeSession(session.id, '2026-08-19T09:10:00Z', 600)
    const sessions = await repo.listSessions()
    expect(sessions[0]?.completedAt).toBe('2026-08-19T09:10:00Z')
    expect(sessions[0]?.durationSeconds).toBe(600)
  })

  it('結果を保存して取得できる', async () => {
    const { repo } = createRepository()
    const session = await repo.createSession({
      sessionType: 'daily',
      startedAt: '2026-08-19T09:00:00Z',
      localDate: d('2026-08-19'),
    })
    await repo.saveResult({
      sessionId: session.id,
      trainingType: 'speed_push',
      passageId: 'biz-001',
      cpm: 700,
      comprehensionScore: 80,
    })
    const results = await repo.listResults()
    expect(results).toHaveLength(1)
    expect(results[0]?.cpm).toBe(700)
    expect(results[0]?.valid).toBe(true)
  })

  it('無効な計測は既定では返さない', async () => {
    const { repo } = createRepository()
    const session = await repo.createSession({
      sessionType: 'daily',
      startedAt: '2026-08-19T09:00:00Z',
      localDate: d('2026-08-19'),
    })
    await repo.saveResult({
      sessionId: session.id,
      trainingType: 'speed_push',
      passageId: 'biz-001',
      cpm: 99999,
      valid: false,
    })
    expect(await repo.listResults()).toHaveLength(0)
    expect(await repo.listResults({ validOnly: false })).toHaveLength(1)
  })

  it('期間とトレーニング種別で絞り込める', async () => {
    const { repo } = createRepository()
    const older = await repo.createSession({
      sessionType: 'daily',
      startedAt: '2026-08-10T09:00:00Z',
      localDate: d('2026-08-10'),
    })
    const newer = await repo.createSession({
      sessionType: 'daily',
      startedAt: '2026-08-19T09:00:00Z',
      localDate: d('2026-08-19'),
    })
    await repo.saveResult({ sessionId: older.id, trainingType: 'speed_push', passageId: null })
    await repo.saveResult({ sessionId: newer.id, trainingType: 'comprehension', passageId: null })

    expect(await repo.listResults({ from: d('2026-08-15') })).toHaveLength(1)
    expect(await repo.listResults({ to: d('2026-08-15') })).toHaveLength(1)
    expect(await repo.listResults({ trainingType: 'comprehension' })).toHaveLength(1)
  })
})

describe('LocalStorageRepository: recall tasks', () => {
  it('翌日タスクを作成できる', async () => {
    const { repo } = createRepository()
    const created = await repo.scheduleRecallTasks([
      {
        passageId: 'biz-001',
        sourceSessionId: 's1',
        scheduledDate: d('2026-08-20'),
        expiresOn: d('2026-08-23'),
      },
    ])
    expect(created).toHaveLength(1)
    expect(created[0]?.status).toBe('pending')
  })

  it('同じ教材・同じ日付のタスクを重複作成しない', async () => {
    const { repo } = createRepository()
    const input = {
      passageId: 'biz-001',
      sourceSessionId: 's1',
      scheduledDate: d('2026-08-20'),
      expiresOn: d('2026-08-23'),
    }
    await repo.scheduleRecallTasks([input])
    const second = await repo.scheduleRecallTasks([input])
    expect(second).toHaveLength(0)
    expect(await repo.listRecallTasks()).toHaveLength(1)
  })

  it('予定日より前は実施対象にならない', async () => {
    const { repo } = createRepository()
    await repo.scheduleRecallTasks([
      {
        passageId: 'biz-001',
        sourceSessionId: null,
        scheduledDate: d('2026-08-20'),
        expiresOn: d('2026-08-23'),
      },
    ])
    expect(await repo.listDueRecallTasks(d('2026-08-19'))).toHaveLength(0)
    expect(await repo.listDueRecallTasks(d('2026-08-20'))).toHaveLength(1)
  })

  it('期限を過ぎたタスクは expired にして返さない', async () => {
    const { repo } = createRepository()
    await repo.scheduleRecallTasks([
      {
        passageId: 'biz-001',
        sourceSessionId: null,
        scheduledDate: d('2026-08-20'),
        expiresOn: d('2026-08-23'),
      },
    ])
    expect(await repo.listDueRecallTasks(d('2026-08-24'))).toHaveLength(0)
    const tasks = await repo.listRecallTasks()
    expect(tasks[0]?.status).toBe('expired')
  })

  it('完了したタスクは再度出てこない', async () => {
    const { repo } = createRepository()
    const [task] = await repo.scheduleRecallTasks([
      {
        passageId: 'biz-001',
        sourceSessionId: null,
        scheduledDate: d('2026-08-20'),
        expiresOn: d('2026-08-23'),
      },
    ])
    await repo.completeRecallTask(task!.id, {
      recallScore: 75,
      recallText: '覚えている内容',
      completedAt: '2026-08-20T09:00:00Z',
    })
    expect(await repo.listDueRecallTasks(d('2026-08-20'))).toHaveLength(0)
    const stored = await repo.listRecallTasks()
    expect(stored[0]?.recallScore).toBe(75)
    expect(stored[0]?.status).toBe('completed')
  })

  it('予定日の古い順に返す', async () => {
    const { repo } = createRepository()
    await repo.scheduleRecallTasks([
      {
        passageId: 'b',
        sourceSessionId: null,
        scheduledDate: d('2026-08-20'),
        expiresOn: d('2026-08-25'),
      },
      {
        passageId: 'a',
        sourceSessionId: null,
        scheduledDate: d('2026-08-19'),
        expiresOn: d('2026-08-24'),
      },
    ])
    const due = await repo.listDueRecallTasks(d('2026-08-21'))
    expect(due.map((t) => t.passageId)).toEqual(['a', 'b'])
  })
})

describe('LocalStorageRepository: reading tests と reset', () => {
  let repo: LocalStorageRepository

  beforeEach(() => {
    repo = createRepository().repo
  })

  it('Baseline の測定結果を保存できる', async () => {
    await repo.saveReadingTest({
      sessionId: null,
      passageId: 'gen-006',
      isBaseline: true,
      elapsedSeconds: 90,
      characterCount: 888,
      cpm: 592,
      comprehensionScore: 80,
      recallScore: 75,
      recallText: '要点3つ',
    })
    const tests = await repo.listReadingTests()
    expect(tests[0]?.isBaseline).toBe(true)
    expect(tests[0]?.cpm).toBe(592)
  })

  it('reset ですべて消える', async () => {
    await repo.saveProfile({ baselineCpm: 600 })
    await repo.reset()
    expect(await repo.getProfile()).toBeNull()
    expect(await repo.listReadingTests()).toHaveLength(0)
  })
})
