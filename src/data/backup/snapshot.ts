import type { z } from 'zod'
import {
  clearAllCollections,
  COLLECTIONS,
  isStoredRecord,
  type CollectionName,
  type RecordStore,
  type StoredRecord,
} from '@/data/persistence/record-store'
import {
  planSchema,
  profileSchema,
  readingTestSchema,
  recallTaskSchema,
  resultSchema,
  sessionSchema,
} from '@/data/repositories/schema'

export const BACKUP_FORMAT = 'speed-reading-lab.backup'
export const BACKUP_VERSION = 1

/**
 * 端末の外へ持ち出せる唯一の形。
 *
 * 保存先の構造（IndexedDB の object store 等）ではなく、collection 単位の
 * 素の JSON にする。将来保存先が変わっても、書き出したファイルは読み込める。
 */
export interface BackupSnapshot {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  collections: Record<CollectionName, unknown[]>
}

export interface ImportReport {
  restored: Record<CollectionName, number>
  /** スキーマに合わず取り込まなかった行数。 */
  skipped: number
  total: number
}

export type ImportResult =
  | { status: 'ok'; report: ImportReport }
  | { status: 'invalid'; reason: 'format' | 'version' }

const SCHEMAS: Record<CollectionName, z.ZodType> = {
  profile: profileSchema,
  sessions: sessionSchema,
  results: resultSchema,
  readingTests: readingTestSchema,
  recallTasks: recallTaskSchema,
  plans: planSchema,
}

const emptyCounts = (): Record<CollectionName, number> => ({
  profile: 0,
  sessions: 0,
  results: 0,
  readingTests: 0,
  recallTasks: 0,
  plans: 0,
})

/** 保存済みの全レコードを書き出す。壊れた行も落とさずそのまま含める。 */
export async function exportSnapshot(
  store: RecordStore,
  exportedAt: string,
): Promise<BackupSnapshot> {
  const collections = {} as Record<CollectionName, unknown[]>
  for (const collection of COLLECTIONS) {
    collections[collection] = await store.list(collection)
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, collections }
}

function readCollection(source: unknown, collection: CollectionName): unknown[] {
  if (typeof source !== 'object' || source === null) return []
  const rows = (source as Record<string, unknown>)[collection]
  return Array.isArray(rows) ? rows : []
}

/**
 * バックアップから復元する。現在のデータは置き換える。
 *
 * 取り込む前に必ずスキーマ検証を通す。手で編集されたファイルや別バージョンの
 * ファイルを読んでも、アプリが起動しなくなる状態にはしない。
 */
export async function importSnapshot(store: RecordStore, raw: unknown): Promise<ImportResult> {
  if (typeof raw !== 'object' || raw === null) return { status: 'invalid', reason: 'format' }
  const candidate = raw as Partial<BackupSnapshot>
  if (candidate.format !== BACKUP_FORMAT) return { status: 'invalid', reason: 'format' }
  if (candidate.version !== BACKUP_VERSION) return { status: 'invalid', reason: 'version' }

  const restored = emptyCounts()
  let skipped = 0
  const accepted = {} as Record<CollectionName, StoredRecord[]>

  for (const collection of COLLECTIONS) {
    const rows = readCollection(candidate.collections, collection)
    const schema = SCHEMAS[collection]
    const valid: StoredRecord[] = []
    for (const row of rows) {
      const parsed = schema.safeParse(row)
      if (parsed.success && isStoredRecord(parsed.data)) valid.push(parsed.data)
      else skipped += 1
    }
    accepted[collection] = valid
    restored[collection] = valid.length
  }

  // 検証を全部通してから置き換える。途中で失敗して「半分だけ復元」にしない。
  await clearAllCollections(store)
  for (const collection of COLLECTIONS) {
    await store.putMany(collection, accepted[collection])
  }

  const total = Object.values(restored).reduce((sum, n) => sum + n, 0)
  return { status: 'ok', report: { restored, skipped, total } }
}

/** ファイル名。同じ端末で複数回書き出しても上書きにならないよう日付を入れる。 */
export function backupFileName(exportedAt: string): string {
  const date = exportedAt.slice(0, 10)
  return `speed-reading-lab-backup-${date}.json`
}
