import { COLLECTIONS, type CollectionName } from '../record-store'

/**
 * スキーマ変更の単位。
 *
 * 「DB を消して作り直す」は通常経路では使わない。version ごとの migration を
 * 積み上げ、古い端末がどの version から来ても順に適用して現在の形へ持ち上げる。
 * 既存の学習記録（Training History / Baseline / Recall / Settings）は
 * migration が明示的に消さない限り保持される。
 */
export interface SchemaMigration {
  /** この migration を適用し終えた時点の DB version。 */
  readonly version: number
  /** 何をする migration なのか（RELEASE ノートと対応させる）。 */
  readonly description: string
  /**
   * versionchange トランザクションの中で**同期的に**呼ばれる。
   * ここで await するとトランザクションが閉じるため、リクエストは同期的に発行する。
   */
  readonly apply: (context: MigrationContext) => void
}

export interface MigrationContext {
  readonly database: IDBDatabase
  /** onupgradeneeded 中の versionchange トランザクション。 */
  readonly transaction: IDBTransaction
}

/** object store を作る（既にあれば何もしない）。 */
export function createCollection(context: MigrationContext, name: CollectionName): void {
  if (context.database.objectStoreNames.contains(name)) return
  context.database.createObjectStore(name, { keyPath: 'id' })
}

/**
 * 既存レコードを 1 件ずつ書き換える。フィールドの改名・既定値の補完に使う。
 * transform が null を返した行は削除する。
 */
export function transformCollection(
  context: MigrationContext,
  name: CollectionName,
  transform: (record: Record<string, unknown>) => Record<string, unknown> | null,
): void {
  if (!context.database.objectStoreNames.contains(name)) return
  const request = context.transaction.objectStore(name).openCursor()
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    const next = transform(cursor.value as Record<string, unknown>)
    if (next === null) cursor.delete()
    else cursor.update(next)
    cursor.continue()
  }
}

/**
 * 実際に適用する migration の並び。
 *
 * **追記のみ。** 既存の要素を書き換えると、その version を通過済みの端末に
 * 変更が届かず、端末ごとにスキーマがずれる。
 */
export const SCHEMA_MIGRATIONS: readonly SchemaMigration[] = [
  {
    version: 1,
    description: 'collection ごとの object store を作る（keyPath: id）',
    apply: (context) => {
      for (const collection of COLLECTIONS) createCollection(context, collection)
    },
  },
  {
    version: 2,
    description: 'BTR の種目記録を入れる btrResults を作る',
    apply: (context) => {
      createCollection(context, 'btrResults')
    },
  },
]

/** 現在のスキーマ version。migration を足せば自動で上がる。 */
export const DATABASE_VERSION = SCHEMA_MIGRATIONS.reduce(
  (latest, migration) => Math.max(latest, migration.version),
  1,
)

/**
 * fromVersion（適用済み）から toVersion までに実行すべき migration。
 * 適用順は version の昇順で固定する。
 */
export function pendingMigrations(
  migrations: readonly SchemaMigration[],
  fromVersion: number,
  toVersion: number,
): SchemaMigration[] {
  return migrations
    .filter((migration) => migration.version > fromVersion && migration.version <= toVersion)
    .sort((a, b) => a.version - b.version)
}

/**
 * onupgradeneeded から呼ぶ。適用した migration の説明を返す（診断用）。
 * 途中で例外が出た場合は versionchange トランザクションが中断され、
 * DB は元の version のまま残る（＝データを壊さない）。
 */
export function runMigrations(
  context: MigrationContext,
  migrations: readonly SchemaMigration[],
  fromVersion: number,
  toVersion: number,
): string[] {
  const applied: string[] = []
  for (const migration of pendingMigrations(migrations, fromVersion, toVersion)) {
    migration.apply(context)
    applied.push(`v${migration.version}: ${migration.description}`)
  }
  return applied
}

/**
 * 想定外の DB（当アプリの migration を通っていないもの）に対する最後の手段。
 * 足りない object store だけを足し、既存データには触らない。
 */
export function repairMissingCollections(context: MigrationContext): void {
  for (const collection of COLLECTIONS) createCollection(context, collection)
}
