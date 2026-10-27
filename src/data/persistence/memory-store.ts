import {
  COLLECTIONS,
  type CollectionName,
  type RecordStore,
  type StoredRecord,
} from './record-store'

/**
 * メモリ上の RecordStore。SSR・テスト・保存先が使えない環境で使う。
 *
 * 出し入れのたびに複製するため、呼び出し側が保持した参照を書き換えても
 * 保存済みデータは変わらない（実際の保存先の挙動に揃える）。
 */
export class MemoryRecordStore implements RecordStore {
  private readonly data: Map<CollectionName, Map<string, StoredRecord>> = new Map(
    COLLECTIONS.map((name) => [name, new Map()]),
  )

  private collection(name: CollectionName): Map<string, StoredRecord> {
    const existing = this.data.get(name)
    if (existing) return existing
    const created = new Map<string, StoredRecord>()
    this.data.set(name, created)
    return created
  }

  async list(collection: CollectionName): Promise<unknown[]> {
    return [...this.collection(collection).values()].map((row) => structuredClone(row))
  }

  async get(collection: CollectionName, id: string): Promise<unknown | null> {
    const found = this.collection(collection).get(id)
    return found ? structuredClone(found) : null
  }

  async put(collection: CollectionName, record: StoredRecord): Promise<void> {
    this.collection(collection).set(record.id, structuredClone(record))
  }

  async putMany(collection: CollectionName, records: readonly StoredRecord[]): Promise<void> {
    const target = this.collection(collection)
    for (const record of records) target.set(record.id, structuredClone(record))
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    this.collection(collection).delete(id)
  }

  async clear(collection: CollectionName): Promise<void> {
    this.collection(collection).clear()
  }
}
