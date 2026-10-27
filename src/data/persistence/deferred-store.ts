import type { CollectionName, RecordStore, StoredRecord } from './record-store'

/**
 * 保存先の決定を初回アクセスまで遅らせる RecordStore。
 *
 * IndexedDB を開くのも旧データの移送も非同期だが、UI から使う
 * `getRepository()` は同期関数のままにしたい。準備をこのクラスに閉じ込めることで、
 * 呼び出し側は「Repository のメソッドを await する」以上のことを知らなくてよい。
 *
 * 準備は一度だけ走り、以後は決まった RecordStore に委譲する。
 */
export class DeferredRecordStore implements RecordStore {
  private target: Promise<RecordStore> | null = null

  constructor(private readonly prepare: () => Promise<RecordStore>) {}

  private resolveTarget(): Promise<RecordStore> {
    this.target ??= this.prepare()
    return this.target
  }

  async list(collection: CollectionName): Promise<unknown[]> {
    return (await this.resolveTarget()).list(collection)
  }

  async get(collection: CollectionName, id: string): Promise<unknown | null> {
    return (await this.resolveTarget()).get(collection, id)
  }

  async put(collection: CollectionName, record: StoredRecord): Promise<void> {
    return (await this.resolveTarget()).put(collection, record)
  }

  async putMany(collection: CollectionName, records: readonly StoredRecord[]): Promise<void> {
    return (await this.resolveTarget()).putMany(collection, records)
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    return (await this.resolveTarget()).remove(collection, id)
  }

  async clear(collection: CollectionName): Promise<void> {
    return (await this.resolveTarget()).clear(collection)
  }
}
