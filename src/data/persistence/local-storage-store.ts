import type { KeyValueStorage } from './key-value-storage'
import {
  isStoredRecord,
  type CollectionName,
  type RecordStore,
  type StoredRecord,
} from './record-store'

/**
 * Phase 1 から使っている localStorage のキー。
 *
 * 「移送元の読み出し」と「IndexedDB が使えない環境でのフォールバック保存」の
 * 両方がこの形式を使う。形式を 1 つに保つことで、どちらの経路でも
 * 端末に残った記録を読み落とさない。
 */
export const LOCAL_STORAGE_KEYS: Record<CollectionName, string> = {
  profile: 'srl:v1:profile',
  sessions: 'srl:v1:sessions',
  results: 'srl:v1:results',
  readingTests: 'srl:v1:reading_tests',
  recallTasks: 'srl:v1:recall_tasks',
  plans: 'srl:v1:plans',
  btrResults: 'srl:v1:btr_results',
}

/** profile は 1 件しかないため、配列ではなく単体で保存されている。 */
function isSingleton(collection: CollectionName): boolean {
  return collection === 'profile'
}

/**
 * localStorage 上の RecordStore。
 *
 * 壊れた JSON は「無かったこと」にして空を返す。
 * 過去の不正なデータでアプリが起動しなくなる事態を避けるため、例外は投げない。
 */
export class LocalStorageRecordStore implements RecordStore {
  constructor(private readonly storage: KeyValueStorage) {}

  private read(collection: CollectionName): StoredRecord[] {
    const raw = this.storage.getItem(LOCAL_STORAGE_KEYS[collection])
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      const rows = isSingleton(collection) ? [parsed] : parsed
      if (!Array.isArray(rows)) return []
      return rows.filter(isStoredRecord)
    } catch {
      return []
    }
  }

  private write(collection: CollectionName, records: readonly StoredRecord[]): void {
    const key = LOCAL_STORAGE_KEYS[collection]
    if (isSingleton(collection)) {
      const only = records[0]
      if (only) this.storage.setItem(key, JSON.stringify(only))
      else this.storage.removeItem(key)
      return
    }
    this.storage.setItem(key, JSON.stringify(records))
  }

  private merge(collection: CollectionName, incoming: readonly StoredRecord[]): void {
    const byId = new Map(this.read(collection).map((row) => [row.id, row]))
    for (const record of incoming) byId.set(record.id, record)
    this.write(collection, [...byId.values()])
  }

  async list(collection: CollectionName): Promise<unknown[]> {
    return this.read(collection)
  }

  async get(collection: CollectionName, id: string): Promise<unknown | null> {
    return this.read(collection).find((row) => row.id === id) ?? null
  }

  async put(collection: CollectionName, record: StoredRecord): Promise<void> {
    this.merge(collection, [record])
  }

  async putMany(collection: CollectionName, records: readonly StoredRecord[]): Promise<void> {
    if (records.length === 0) return
    this.merge(collection, records)
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    this.write(
      collection,
      this.read(collection).filter((row) => row.id !== id),
    )
  }

  async clear(collection: CollectionName): Promise<void> {
    this.storage.removeItem(LOCAL_STORAGE_KEYS[collection])
  }
}
