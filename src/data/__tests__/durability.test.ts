import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { toLocalDate, type LocalDate } from '@/core/types'
import { exportSnapshot, importSnapshot } from '@/data/backup/snapshot'
import { createLocalFirstStore } from '@/data/persistence/create-store'
import { IndexedDbRecordStore } from '@/data/persistence/indexeddb/indexeddb-store'
import { SCHEMA_MIGRATIONS, type SchemaMigration } from '@/data/persistence/indexeddb/migrations'
import { MemoryStorage } from '@/data/persistence/key-value-storage'
import { clearAllCollections, type RecordStore } from '@/data/persistence/record-store'
import { RecordStoreRepository } from '@/data/repositories/repository'

/**
 * 学習データが失われないことを、実装をまたいで確認する。
 *
 * ここが落ちる＝ユーザーの記録が消える、という位置づけのテスト。
 * 個々の部品ではなく Repository ごしの「アプリから見える状態」で検証する。
 */

const TODAY = toLocalDate('2026-08-20')
const V1_ONLY = [SCHEMA_MIGRATIONS[0]!]

function createRepository(store: RecordStore) {
  let counter = 0
  return new RecordStoreRepository({
    store,
    now: () => new Date('2026-08-19T09:00:00Z'),
    createId: () => `id-${++counter}`,
    defaultTimezone: 'Asia/Tokyo',
  })
}

/** 一通りの学習記録（Baseline / History / Recall / Settings / Plan）を書き込む。 */
async function seedLearningData(store: RecordStore, date: LocalDate = TODAY) {
  const repository = createRepository(store)

  await repository.saveProfile({
    baselineCpm: 620,
    targetCpm: 713,
    preferredDurationMinutes: 20,
    displayName: '学習者',
  })
  await repository.saveReadingTest({
    sessionId: null,
    passageId: 'base-001',
    isBaseline: true,
    elapsedSeconds: 120,
    characterCount: 1200,
    cpm: 600,
    comprehensionScore: 75,
    recallScore: 60,
    recallText: '要点',
  })
  const session = await repository.createSession({
    sessionType: 'daily',
    startedAt: '2026-08-19T09:00:00.000Z',
    localDate: date,
  })
  await repository.saveResult({
    sessionId: session.id,
    trainingType: 'speed_push',
    passageId: 'biz-001',
    cpm: 700,
    comprehensionScore: 80,
  })
  await repository.saveResult({
    sessionId: session.id,
    trainingType: 'immediate_recall',
    passageId: 'biz-001',
    immediateRecallScore: 70,
  })
  await repository.scheduleRecallTasks([
    {
      passageId: 'biz-001',
      sourceSessionId: session.id,
      scheduledDate: date,
      expiresOn: toLocalDate('2099-12-31'),
    },
  ])
  return repository
}

/** アプリから見える学習状態のスナップショット。比較用。 */
async function readLearningState(repository: RecordStoreRepository) {
  return {
    profile: await repository.getProfile(),
    results: await repository.listResults(),
    sessions: await repository.listSessions(),
    readingTests: await repository.listReadingTests(),
    recallTasks: await repository.listRecallTasks(),
  }
}

describe('耐久性: アプリ更新（IndexedDB の version 上げ）', () => {
  it('スキーマが上がっても学習記録が残る', async () => {
    const factory = new IDBFactory()

    const before = new IndexedDbRecordStore({ factory, migrations: V1_ONLY })
    const seeded = await seedLearningData(before)
    const expected = await readLearningState(seeded)
    await before.close()

    // アプリを更新した（migration が 1 本増えた）状態で開き直す
    const nextMigration: SchemaMigration = {
      version: 2,
      description: 'アプリ更新のシミュレーション',
      apply: () => undefined,
    }
    const after = new IndexedDbRecordStore({
      factory,
      migrations: [...V1_ONLY, nextMigration],
    })
    const upgraded = createRepository(after)

    expect((await after.open()).version).toBe(2)
    expect(await readLearningState(upgraded)).toEqual(expected)
    expect(expected.results).toHaveLength(2)
    expect(expected.profile?.baselineCpm).toBe(620)
  })

  it('翌日 Recall の予定も更新後に実施できる', async () => {
    const factory = new IDBFactory()
    const before = new IndexedDbRecordStore({ factory, migrations: V1_ONLY })
    await seedLearningData(before)
    await before.close()

    const after = new IndexedDbRecordStore({
      factory,
      migrations: [...V1_ONLY, { version: 2, description: 'update', apply: () => undefined }],
    })
    const repository = createRepository(after)

    const due = await repository.listDueRecallTasks(TODAY)
    expect(due).toHaveLength(1)

    await repository.completeRecallTask(due[0]!.id, {
      recallScore: 80,
      recallText: '翌日の再現',
      completedAt: '2026-08-20T09:00:00.000Z',
    })
    const tasks = await repository.listRecallTasks()
    expect(tasks[0]?.status).toBe('completed')
    expect(tasks[0]?.recallScore).toBe(80)
  })
})

describe('耐久性: Backup の往復', () => {
  it('書き出し → 初期化 → 取り込みで元の状態に戻る', async () => {
    const factory = new IDBFactory()
    const store = new IndexedDbRecordStore({ factory })
    const repository = await seedLearningData(store)
    const expected = await readLearningState(repository)

    const snapshot = await exportSnapshot(store, {
      exportedAt: '2026-08-20T00:00:00.000Z',
      appVersion: '0.1.0',
    })
    // ファイルとして往復させる（JSON にできない値が混ざっていないことも確認する）
    const file: unknown = JSON.parse(JSON.stringify(snapshot))

    await clearAllCollections(store)
    expect((await readLearningState(repository)).results).toHaveLength(0)

    const outcome = await importSnapshot(store, file)
    expect(outcome.status).toBe('ok')
    expect(await readLearningState(repository)).toEqual(expected)
  })

  it('別端末の空の DB へ取り込んでも同じ状態になる', async () => {
    const source = new IndexedDbRecordStore({ factory: new IDBFactory() })
    const repository = await seedLearningData(source)
    const expected = await readLearningState(repository)

    const snapshot = await exportSnapshot(source, {
      exportedAt: '2026-08-20T00:00:00.000Z',
      appVersion: '0.1.0',
    })

    const target = new IndexedDbRecordStore({ factory: new IDBFactory() })
    await importSnapshot(target, JSON.parse(JSON.stringify(snapshot)))

    expect(await readLearningState(createRepository(target))).toEqual(expected)
  })
})

describe('耐久性: migration の失敗', () => {
  it('途中で失敗しても既存データを壊さない', async () => {
    const factory = new IDBFactory()
    const before = new IndexedDbRecordStore({ factory, migrations: V1_ONLY })
    const seeded = await seedLearningData(before)
    const expected = await readLearningState(seeded)
    await before.close()

    const broken = new IndexedDbRecordStore({
      factory,
      migrations: [
        ...V1_ONLY,
        {
          version: 2,
          description: '途中で失敗する migration',
          apply: () => {
            throw new Error('migration failed')
          },
        },
      ],
    })
    await expect(broken.open()).rejects.toThrow()

    // 旧アプリ（v1）で開き直すと、記録はそのまま残っている
    const recovered = new IndexedDbRecordStore({ factory, migrations: V1_ONLY })
    expect((await recovered.open()).version).toBe(1)
    expect(await readLearningState(createRepository(recovered))).toEqual(expected)
  })
})

describe('耐久性: IndexedDB が使えない環境', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('localStorage に退避してもトレーニングを続けられる', async () => {
    const store = createLocalFirstStore({ storage, indexedDB: null })
    const repository = await seedLearningData(store)

    const state = await readLearningState(repository)
    expect(state.results).toHaveLength(2)
    expect(state.profile?.baselineCpm).toBe(620)
    expect(await repository.listDueRecallTasks(TODAY)).toHaveLength(1)

    // 保存先が localStorage であること（＝再起動しても残る）
    expect(storage.getItem('srl:v1:results')).toContain('speed_push')
  })

  it('退避したまま再起動しても記録が残る', async () => {
    const first = createLocalFirstStore({ storage, indexedDB: null })
    const repository = await seedLearningData(first)
    const expected = await readLearningState(repository)

    // 同じ端末でアプリを開き直す
    const second = createLocalFirstStore({ storage, indexedDB: null })
    expect(await readLearningState(createRepository(second))).toEqual(expected)
  })

  it('IndexedDB が後から使えるようになったら移送される', async () => {
    const offlineStore = createLocalFirstStore({ storage, indexedDB: null })
    const repository = await seedLearningData(offlineStore)
    const expected = await readLearningState(repository)

    // 別ブラウザ・設定変更などで IndexedDB が使えるようになった状態
    const restored = createLocalFirstStore({ storage, indexedDB: new IDBFactory() })
    expect(await readLearningState(createRepository(restored))).toEqual(expected)
    expect(storage.getItem('srl:v1:results')).toBeNull()
  })
})
