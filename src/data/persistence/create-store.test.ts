import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createLocalFirstStore } from './create-store'
import { MemoryStorage } from './key-value-storage'
import { LOCAL_STORAGE_KEYS } from './local-storage-store'

const legacyResult = { id: 'r1', sessionId: 's1', cpm: 700 }

function storageWithLegacyData(): MemoryStorage {
  const storage = new MemoryStorage()
  storage.setItem(LOCAL_STORAGE_KEYS.results, JSON.stringify([legacyResult]))
  return storage
}

/** open が必ず失敗する IDBFactory。プライベートモード等の再現。 */
function brokenIndexedDb(): IDBFactory {
  return {
    open: () => {
      const request = { onerror: null, onsuccess: null, onupgradeneeded: null, error: new Error('blocked') }
      queueMicrotask(() => (request.onerror as unknown as () => void)?.())
      return request as unknown as IDBOpenDBRequest
    },
  } as unknown as IDBFactory
}

describe('createLocalFirstStore', () => {
  it('IndexedDB があればそこに保存し、旧 localStorage データを引き継ぐ', async () => {
    const storage = storageWithLegacyData()
    const store = createLocalFirstStore({ storage, indexedDB: new IDBFactory() })

    expect(await store.list('results')).toHaveLength(1)
    // 移送済みなので旧キーは残らない
    expect(storage.getItem(LOCAL_STORAGE_KEYS.results)).toBeNull()

    await store.put('results', { id: 'r2' })
    expect(await store.list('results')).toHaveLength(2)
  })

  it('IndexedDB が無い環境では localStorage で動き続ける', async () => {
    const storage = storageWithLegacyData()
    const store = createLocalFirstStore({ storage, indexedDB: null })

    expect(await store.list('results')).toHaveLength(1)
    await store.put('results', { id: 'r2' })
    expect(storage.getItem(LOCAL_STORAGE_KEYS.results)).toContain('r2')
  })

  it('IndexedDB が開けなくてもトレーニングは続けられる', async () => {
    const storage = storageWithLegacyData()
    const store = createLocalFirstStore({
      storage,
      indexedDB: brokenIndexedDb(),
      openTimeoutMs: 50,
    })

    expect(await store.list('results')).toHaveLength(1)
    await store.put('results', { id: 'r2' })
    expect(await store.list('results')).toHaveLength(2)
  })

  it('保存先の決定と移送は一度だけ走る', async () => {
    const storage = storageWithLegacyData()
    const store = createLocalFirstStore({ storage, indexedDB: new IDBFactory() })

    const [first, second] = await Promise.all([store.list('results'), store.list('results')])
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
  })
})
