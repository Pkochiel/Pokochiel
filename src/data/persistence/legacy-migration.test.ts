import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorage } from './key-value-storage'
import { importLegacyRecords } from './legacy-migration'
import { LOCAL_STORAGE_KEYS } from './local-storage-store'
import { MemoryRecordStore } from './memory-store'

const profile = { id: 'local-user', baselineCpm: 620 }
const session = { id: 's1', userId: 'local-user', localDate: '2026-08-18' }
const result = { id: 'r1', sessionId: 's1', trainingType: 'speed_push', cpm: 700 }

function seedLegacy(storage: MemoryStorage): void {
  storage.setItem(LOCAL_STORAGE_KEYS.profile, JSON.stringify(profile))
  storage.setItem(LOCAL_STORAGE_KEYS.sessions, JSON.stringify([session]))
  storage.setItem(LOCAL_STORAGE_KEYS.results, JSON.stringify([result]))
}

describe('importLegacyRecords', () => {
  let storage: MemoryStorage
  let store: MemoryRecordStore

  beforeEach(() => {
    storage = new MemoryStorage()
    store = new MemoryRecordStore()
  })

  it('Phase 1 の記録を新しい保存先へ移す', async () => {
    seedLegacy(storage)
    const report = await importLegacyRecords(store, storage)

    expect(report.total).toBe(3)
    expect(report.imported.sessions).toBe(1)
    expect(await store.get('profile', 'local-user')).toMatchObject({ baselineCpm: 620 })
    expect(await store.list('results')).toHaveLength(1)
  })

  it('移送後に旧キーを消して、正となる保存先を 1 つに保つ', async () => {
    seedLegacy(storage)
    await importLegacyRecords(store, storage)

    expect(storage.getItem(LOCAL_STORAGE_KEYS.profile)).toBeNull()
    expect(storage.getItem(LOCAL_STORAGE_KEYS.sessions)).toBeNull()
    expect(storage.getItem(LOCAL_STORAGE_KEYS.results)).toBeNull()
  })

  it('2 回目は何もしない（起動のたびに呼んでよい）', async () => {
    seedLegacy(storage)
    await importLegacyRecords(store, storage)
    const second = await importLegacyRecords(store, storage)

    expect(second.total).toBe(0)
    expect(await store.list('sessions')).toHaveLength(1)
  })

  it('移送先に同じ id があっても重複させない', async () => {
    seedLegacy(storage)
    const stale = { ...session, localDate: '2026-01-01' }
    await store.put('sessions', stale)
    await importLegacyRecords(store, storage)

    const sessions = await store.list('sessions')
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ localDate: '2026-08-18' })
  })

  it('旧データが無ければ何もしない', async () => {
    const report = await importLegacyRecords(store, storage)
    expect(report.total).toBe(0)
  })

  it('壊れた旧データがあっても起動を止めない', async () => {
    storage.setItem(LOCAL_STORAGE_KEYS.results, '{ this is not json')
    storage.setItem(LOCAL_STORAGE_KEYS.sessions, JSON.stringify([session, null, { noId: true }]))

    const report = await importLegacyRecords(store, storage)
    expect(report.imported.results).toBe(0)
    expect(await store.list('sessions')).toHaveLength(1)
  })
})
