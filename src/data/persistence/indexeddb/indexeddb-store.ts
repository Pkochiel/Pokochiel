import {
  COLLECTIONS,
  type CollectionName,
  type RecordStore,
  type StoredRecord,
} from '../record-store'
import { openDatabase, readFromStore, writeToStore } from './idb'
import {
  DATABASE_VERSION,
  repairMissingCollections,
  runMigrations,
  SCHEMA_MIGRATIONS,
  type SchemaMigration,
} from './migrations'

export const DATABASE_NAME = 'speed-reading-lab'
export { DATABASE_VERSION }

export interface IndexedDbRecordStoreDeps {
  factory: IDBFactory
  databaseName?: string
  /** スキーマの並び。テストで別の並びを注入するためだけに差し替える。 */
  migrations?: readonly SchemaMigration[]
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

  private get migrations(): readonly SchemaMigration[] {
    return this.deps.migrations ?? SCHEMA_MIGRATIONS
  }

  private get targetVersion(): number {
    return this.migrations.reduce((latest, migration) => Math.max(latest, migration.version), 1)
  }

  /**
   * 現在のスキーマまで migration を適用した接続を返す。
   *
   * 通常経路は version migration（保存済みデータはそのまま引き継ぐ）。
   * 想定外の DB —— 当アプリの migration を通っていない、object store が
   * 足りない状態 —— に当たったときだけ、version を上げて不足分を補う。
   * こちらは fallback であり、データの削除は行わない。
   */
  private async connect(): Promise<IDBDatabase> {
    const name = this.deps.databaseName ?? DATABASE_NAME
    const migrations = this.migrations

    const database = await openDatabase({
      factory: this.deps.factory,
      name,
      version: this.targetVersion,
      upgrade: (context) => {
        runMigrations(context, migrations, context.oldVersion, context.newVersion)
      },
    })
    if (COLLECTIONS.every((collection) => database.objectStoreNames.contains(collection))) {
      return database
    }

    const nextVersion = database.version + 1
    database.close()
    return openDatabase({
      factory: this.deps.factory,
      name,
      version: nextVersion,
      upgrade: (context) => repairMissingCollections(context),
    })
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
