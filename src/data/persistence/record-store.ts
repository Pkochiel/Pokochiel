/**
 * 永続化の下位ポート。Repository が依存する唯一の保存インタフェース。
 *
 * Repository は「どの技術で保存するか」を知らない。IndexedDB / localStorage /
 * メモリの差はこのポートの実装差に閉じ込める。ドメイン型も持ち込まない
 * （検証は Repository 側の zod が行う）ため、保存層はドメインの変更に追従しない。
 *
 * 将来 Sync Engine を足すときも、このポートを実装したデコレータを 1 枚挟むだけで済む。
 * UI と Core Domain は RecordStore の存在自体を知らない。
 */

/** 保存単位。リレーショナル DB のテーブル 1 つに相当する。 */
export const COLLECTIONS = [
  'profile',
  'sessions',
  'results',
  'readingTests',
  'recallTasks',
  'plans',
] as const

export type CollectionName = (typeof COLLECTIONS)[number]

/** 保存されるレコードの最小要件。id で一意に識別できること。 */
export interface StoredRecord {
  readonly id: string
}

export interface RecordStore {
  /** collection の全レコード。順序は保証しない（呼び出し側で整列する）。 */
  list(collection: CollectionName): Promise<unknown[]>
  get(collection: CollectionName, id: string): Promise<unknown | null>
  put(collection: CollectionName, record: StoredRecord): Promise<void>
  /** 複数レコードをまとめて保存する。実装は可能なら不可分に行う。 */
  putMany(collection: CollectionName, records: readonly StoredRecord[]): Promise<void>
  remove(collection: CollectionName, id: string): Promise<void>
  clear(collection: CollectionName): Promise<void>
}

/** すべての collection を空にする。 */
export async function clearAllCollections(store: RecordStore): Promise<void> {
  for (const collection of COLLECTIONS) {
    await store.clear(collection)
  }
}

/** レコードとして扱えるか。壊れた行を落とすために保存層で使う。 */
export function isStoredRecord(value: unknown): value is StoredRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string'
  )
}
