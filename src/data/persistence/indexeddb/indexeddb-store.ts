import {
  COLLECTIONS,
  type CollectionName,
  type RecordStore,
  type StoredRecord,
} from '../record-store'
import { openDatabase, readFromStore, writeToStore } from './idb'

export const DATABASE_NAME = 'speed-reading-lab'
export const DATABASE_VERSION = 1

export interface IndexedDbRecordStoreDeps {
  factory: IDBFactory
  databaseName?: string
}

/**
 * IndexedDB 上の RecordStore。オフラインでの保存先。
 *
 * object store は collection と 1 対 1 で、keyPath は id。
 * 検索条件を持たない（一覧して呼び出し側で絞る）のは、保存層にドメインの
 * 都合を持ち込まないため。件数は個人の学習記録の規模で、全件取得で足りる。
 */
export class IndexedDbRecordStore implements RecordStore {
  private connection: Promise<IDBDatabase> | null = null

  constructor(private readonly deps: IndexedDbRecordStoreDeps) {}

  /**
   * 接続を確立する。使えない環境（プライベートモード等）ではここで失敗するため、
   * 呼び出し側は代替の保存先へ切り替えられる。
   */
  open(): Promise<IDBDatabase> {
    this.connection ??= this.connect()
    return this.connection
  }

  private createMissingStores(database: IDBDatabase): void {
    for (const collection of COLLECTIONS) {
      if (!database.objectStoreNames.contains(collection)) {
        database.createObjectStore(collection, { keyPath: 'id' })
      }
    }
  }

  /**
   * 必要な object store が揃った接続を返す。
   *
   * 同じ version で store の無い DB が既にあると upgrade が二度と走らず、
   * 保存できないまま無言で失敗し続ける。その場合は version を上げて作り直す
   * （既存レコードは消さない）。
   */
  private async connect(): Promise<IDBDatabase> {
    const name = this.deps.databaseName ?? DATABASE_NAME
    const upgrade = (database: IDBDatabase) => this.createMissingStores(database)

    const database = await openDatabase({
      factory: this.deps.factory,
      name,
      version: DATABASE_VERSION,
      upgrade,
    })
    if (COLLECTIONS.every((collection) => database.objectStoreNames.contains(collection))) {
      return database
    }

    const nextVersion = database.version + 1
    database.close()
    return openDatabase({ factory: this.deps.factory, name, version: nextVersion, upgrade })
  }

  /** 接続を閉じる（テストと、別タブからの upgrade 時に使う）。 */
  async close(): Promise<void> {
    const database = await this.connection
    database?.close()
    this.connection = null
  }

  async list(collection: CollectionName): Promise<unknown[]> {
    const database = await this.open()
    const rows = await readFromStore(database, collection, (store) => store.getAll())
    return rows as unknown[]
  }

  async get(collection: CollectionName, id: string): Promise<unknown | null> {
    const database = await this.open()
    const row = await readFromStore(database, collection, (store) => store.get(id))
    return (row as unknown) ?? null
  }

  async put(collection: CollectionName, record: StoredRecord): Promise<void> {
    const database = await this.open()
    await writeToStore(database, collection, (store) => {
      store.put(record)
    })
  }

  async putMany(collection: CollectionName, records: readonly StoredRecord[]): Promise<void> {
    if (records.length === 0) return
    const database = await this.open()
    await writeToStore(database, collection, (store) => {
      for (const record of records) store.put(record)
    })
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    const database = await this.open()
    await writeToStore(database, collection, (store) => {
      store.delete(id)
    })
  }

  async clear(collection: CollectionName): Promise<void> {
    const database = await this.open()
    await writeToStore(database, collection, (store) => {
      store.clear()
    })
  }
}
