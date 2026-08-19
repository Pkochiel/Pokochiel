import { createBrowserStorage } from './key-value-storage'
import { createLocalFirstStore, detectIndexedDb } from './create-store'
import type { RecordStore } from './record-store'

export type { CollectionName, RecordStore, StoredRecord } from './record-store'
export { COLLECTIONS, clearAllCollections } from './record-store'
export { MemoryRecordStore } from './memory-store'

let instance: RecordStore | null = null

/**
 * アプリが使う保存先。Repository と Backup の両方がここから受け取る。
 * 実体（IndexedDB か localStorage か）は起動時に決まり、上位からは見えない。
 */
export function getPersistentStore(): RecordStore {
  instance ??= createLocalFirstStore({
    storage: createBrowserStorage(),
    indexedDB: detectIndexedDb(),
  })
  return instance
}

/** テスト・開発用に差し替える。 */
export function setPersistentStore(store: RecordStore | null): void {
  instance = store
}
