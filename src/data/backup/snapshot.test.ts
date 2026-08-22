import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRecordStore } from '@/data/persistence/memory-store'
import { BACKUP_FORMAT, backupFileName, exportSnapshot, importSnapshot } from './snapshot'
import { BACKUP_SCHEMA_VERSION } from './migrations'

const asRecord = (record: { id: string } & Record<string, unknown>) => record

const profile = asRecord({
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
})

const session = asRecord({
  id: 's1',
  userId: 'local-user',
  startedAt: '2026-08-18T09:00:00.000Z',
  completedAt: null,
  durationSeconds: null,
  sessionType: 'daily',
  localDate: '2026-08-18',
})

const result = asRecord({
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
})

const options = { exportedAt: '2026-08-19T00:00:00.000Z', appVersion: '0.1.0' }

describe('backup snapshot', () => {
  let store: MemoryRecordStore

  beforeEach(async () => {
    store = new MemoryRecordStore()
    await store.put('profile', profile)
    await store.put('sessions', session)
    await store.put('results', result)
  })

  it('version 付きの形式で書き出す', async () => {
    const snapshot = await exportSnapshot(store, options)
    expect(snapshot.format).toBe(BACKUP_FORMAT)
    expect(snapshot.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(snapshot.appVersion).toBe('0.1.0')
    expect(snapshot.exportedAt).toBe(options.exportedAt)
    expect(snapshot.data.results).toHaveLength(1)
    expect(snapshot.data.plans).toEqual([])
  })

  it('書き出したファイルから元に戻せる', async () => {
    const snapshot = await exportSnapshot(store, options)
    const json: unknown = JSON.parse(JSON.stringify(snapshot))

    const empty = new MemoryRecordStore()
    const outcome = await importSnapshot(empty, json)

    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return
    expect(outcome.report.total).toBe(3)
    expect(outcome.report.sourceVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(await empty.get('results', 'r1')).toMatchObject({ cpm: 700 })
    expect(await empty.get('profile', 'local-user')).toMatchObject({ baselineCpm: 620 })
  })

  it('復元は現在のデータを置き換える', async () => {
    const snapshot = await exportSnapshot(store, options)
    await store.put('results', { ...result, id: 'r2' })
    expect(await store.list('results')).toHaveLength(2)

    await importSnapshot(store, snapshot)
    const ids = ((await store.list('results')) as { id: string }[]).map((r) => r.id)
    expect(ids).toEqual(['r1'])
  })

  it('スキーマに合わない行は取り込まず、件数を報告する', async () => {
    const outcome = await importSnapshot(new MemoryRecordStore(), {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: options.exportedAt,
      appVersion: '0.1.0',
      data: { results: [result, { id: 'broken', cpm: 'fast' }] },
    })

    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return
    expect(outcome.report.restored.results).toBe(1)
    expect(outcome.report.skipped).toBe(1)
  })

  it('ファイル名に書き出した日付を入れる', () => {
    expect(backupFileName('2026-08-19T12:34:56.000Z')).toBe(
      'speed-reading-lab-backup-2026-08-19.json',
    )
  })
})

describe('旧バックアップの取り込み', () => {
  /** v1 は version / collections というフィールド名だった。 */
  const v1Backup = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: '2026-08-01T00:00:00.000Z',
    collections: { profile: [profile], sessions: [session], results: [result] },
  }

  it('v1 のファイルを現行スキーマへ移して取り込める', async () => {
    const store = new MemoryRecordStore()
    const outcome = await importSnapshot(store, v1Backup)

    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return
    expect(outcome.report.sourceVersion).toBe(1)
    expect(outcome.report.total).toBe(3)
    expect(await store.get('profile', 'local-user')).toMatchObject({ baselineCpm: 620 })
    expect(await store.get('results', 'r1')).toMatchObject({ cpm: 700 })
  })

  it('v1 でも壊れた行は取り込まない', async () => {
    const store = new MemoryRecordStore()
    const outcome = await importSnapshot(store, {
      ...v1Backup,
      collections: { results: [result, { id: 'broken' }] },
    })

    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return
    expect(outcome.report.restored.results).toBe(1)
    expect(outcome.report.skipped).toBe(1)
  })
})

describe('受け付けないファイル', () => {
  it('別形式・未対応 version・壊れた中身を区別して拒否する', async () => {
    const store = new MemoryRecordStore()

    expect(await importSnapshot(store, { hello: 'world' })).toEqual({
      status: 'invalid',
      reason: 'format',
    })
    expect(await importSnapshot(store, 'not json object')).toEqual({
      status: 'invalid',
      reason: 'format',
    })
    // 将来の形式は推測で読まない
    expect(
      await importSnapshot(store, { format: BACKUP_FORMAT, schemaVersion: 99, data: {} }),
    ).toEqual({ status: 'invalid', reason: 'version' })
    // 形式は合っているが中身が壊れている
    expect(
      await importSnapshot(store, {
        format: BACKUP_FORMAT,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: null,
        appVersion: null,
        data: 'broken',
      }),
    ).toEqual({ status: 'invalid', reason: 'corrupt' })
    expect(await importSnapshot(store, { format: BACKUP_FORMAT, version: 1 })).toEqual({
      status: 'invalid',
      reason: 'corrupt',
    })
  })

  it('受け付けなかったときは既存データを消さない', async () => {
    const store = new MemoryRecordStore()
    await store.put('results', result)

    await importSnapshot(store, { hello: 'world' })
    await importSnapshot(store, { format: BACKUP_FORMAT, schemaVersion: 99, data: {} })
    await importSnapshot(store, { format: BACKUP_FORMAT, version: 1 })

    expect(await store.list('results')).toHaveLength(1)
  })
})

describe('BTR の記録の持ち出し', () => {
  const btrResult = asRecord({
    id: 'b1',
    userId: 'local-user',
    sessionId: 's1',
    exercise: 'number_random',
    score: 24,
    attempts: [22, 20, 18, 24],
    elapsedMs: 240_000,
    timeLimitMs: 60_000,
    accuracy: 92,
    level: 1,
    lowerIsBetter: false,
    cpm: null,
    valid: true,
    localDate: '2026-08-22',
    createdAt: '2026-08-22T09:00:00.000Z',
  })

  it('書き出して取り込むと元に戻る', async () => {
    const store = new MemoryRecordStore()
    await store.put('btrResults', btrResult)

    const snapshot = await exportSnapshot(store, { exportedAt: null, appVersion: null })
    const restored = new MemoryRecordStore()
    const result = await importSnapshot(restored, snapshot)

    expect(result.status).toBe('ok')
    expect(await restored.list('btrResults')).toEqual([btrResult])
  })

  it('複数試行の並びを保つ', async () => {
    // 合計や平均に潰れると、どの枚で落ちたかが持ち出せない。
    const store = new MemoryRecordStore()
    await store.put('btrResults', btrResult)
    const restored = new MemoryRecordStore()
    await importSnapshot(
      restored,
      await exportSnapshot(store, { exportedAt: null, appVersion: null }),
    )
    const [row] = (await restored.list('btrResults')) as { attempts: number[] }[]
    expect(row?.attempts).toEqual([22, 20, 18, 24])
  })

  it('BTR より前のバックアップも取り込める', async () => {
    // btrResults を持たないファイルが「壊れている」扱いにならないこと。
    const store = new MemoryRecordStore()
    await store.put('profile', profile)
    const snapshot = await exportSnapshot(store, { exportedAt: null, appVersion: null })
    const withoutBtr = { ...snapshot, data: { ...snapshot.data } }
    delete (withoutBtr.data as Record<string, unknown>)['btrResults']

    const restored = new MemoryRecordStore()
    const result = await importSnapshot(restored, withoutBtr)
    expect(result.status).toBe('ok')
    expect(await restored.list('btrResults')).toEqual([])
  })
})
