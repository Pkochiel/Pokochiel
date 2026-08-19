import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRecordStore } from '@/data/persistence/memory-store'
import { BACKUP_FORMAT, backupFileName, exportSnapshot, importSnapshot } from './snapshot'

const profile = {
  id: 'local-user',
  displayName: null,
  baselineCpm: 620,
  targetCpm: 713,
  preferredDurationMinutes: 30,
  chunkLevel: 2,
  timezone: 'Asia/Tokyo',
  onboardedAt: '2026-08-18T00:00:00.000Z',
  createdAt: '2026-08-18T00:00:00.000Z',
  updatedAt: '2026-08-18T00:00:00.000Z',
}

const session = {
  id: 's1',
  userId: 'local-user',
  startedAt: '2026-08-18T09:00:00.000Z',
  completedAt: null,
  durationSeconds: null,
  sessionType: 'daily',
  localDate: '2026-08-18',
}

const result = {
  id: 'r1',
  userId: 'local-user',
  sessionId: 's1',
  trainingType: 'speed_push',
  passageId: 'biz-001',
  cpm: 700,
  comprehensionScore: 80,
  immediateRecallScore: null,
  delayedRecallScore: null,
  targetCpm: 713,
  backCount: null,
  pauseCount: null,
  difficulty: 3,
  valid: true,
  createdAt: '2026-08-18T09:10:00.000Z',
}

describe('backup snapshot', () => {
  let store: MemoryRecordStore

  beforeEach(async () => {
    store = new MemoryRecordStore()
    await store.put('profile', profile)
    await store.put('sessions', session)
    await store.put('results', result)
  })

  it('保存済みのデータを書き出せる', async () => {
    const snapshot = await exportSnapshot(store, '2026-08-19T00:00:00.000Z')
    expect(snapshot.format).toBe(BACKUP_FORMAT)
    expect(snapshot.version).toBe(1)
    expect(snapshot.collections.results).toHaveLength(1)
    expect(snapshot.collections.plans).toEqual([])
  })

  it('書き出したファイルから元に戻せる', async () => {
    const snapshot = await exportSnapshot(store, '2026-08-19T00:00:00.000Z')
    const json: unknown = JSON.parse(JSON.stringify(snapshot))

    const empty = new MemoryRecordStore()
    const outcome = await importSnapshot(empty, json)

    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return
    expect(outcome.report.total).toBe(3)
    expect(await empty.get('results', 'r1')).toMatchObject({ cpm: 700 })
    expect(await empty.get('profile', 'local-user')).toMatchObject({ baselineCpm: 620 })
  })

  it('復元は現在のデータを置き換える', async () => {
    const snapshot = await exportSnapshot(store, '2026-08-19T00:00:00.000Z')
    await store.put('results', { ...result, id: 'r2' })
    expect(await store.list('results')).toHaveLength(2)

    await importSnapshot(store, snapshot)
    const ids = ((await store.list('results')) as { id: string }[]).map((r) => r.id)
    expect(ids).toEqual(['r1'])
  })

  it('スキーマに合わない行は取り込まず、件数を報告する', async () => {
    const outcome = await importSnapshot(new MemoryRecordStore(), {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: '2026-08-19T00:00:00.000Z',
      collections: { results: [result, { id: 'broken', cpm: 'fast' }] },
    })

    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return
    expect(outcome.report.restored.results).toBe(1)
    expect(outcome.report.skipped).toBe(1)
  })

  it('別形式のファイルは受け付けない', async () => {
    const target = new MemoryRecordStore()
    expect(await importSnapshot(target, { hello: 'world' })).toEqual({
      status: 'invalid',
      reason: 'format',
    })
    expect(await importSnapshot(target, 'not json object')).toEqual({
      status: 'invalid',
      reason: 'format',
    })
    expect(
      await importSnapshot(target, { format: BACKUP_FORMAT, version: 99, collections: {} }),
    ).toEqual({ status: 'invalid', reason: 'version' })

    // 受け付けなかったときは既存データを消さない
    await target.put('results', result)
    await importSnapshot(target, { hello: 'world' })
    expect(await target.list('results')).toHaveLength(1)
  })

  it('ファイル名に書き出した日付を入れる', () => {
    expect(backupFileName('2026-08-19T12:34:56.000Z')).toBe(
      'speed-reading-lab-backup-2026-08-19.json',
    )
  })
})
