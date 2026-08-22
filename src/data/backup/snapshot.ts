import { z } from 'zod'
import {
  clearAllCollections,
  COLLECTIONS,
  isStoredRecord,
  type CollectionName,
  type RecordStore,
  type StoredRecord,
} from '@/data/persistence/record-store'
import {
  btrResultSchema,
  planSchema,
  profileSchema,
  readingTestSchema,
  recallTaskSchema,
  resultSchema,
  sessionSchema,
} from '@/data/repositories/schema'
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  detectBackupVersion,
  migrateBackup,
  type RawSnapshot,
} from './migrations'

export { BACKUP_FORMAT, BACKUP_SCHEMA_VERSION } from './migrations'

/**
 * 端末の外へ持ち出せる唯一の形。
 *
 * 保存先の構造（IndexedDB の object store 等）ではなく collection 単位の素の JSON。
 * schemaVersion を持つのは、形を変えたあとも古いファイルを読み続けるため。
 */
export interface BackupSnapshot {
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  exportedAt: string | null
  /** 書き出したアプリの版。取り込み時の判断材料であり、検証には使わない。 */
  appVersion: string | null
  data: Record<CollectionName, unknown[]>
}

export interface ImportReport {
  restored: Record<CollectionName, number>
  /** スキーマに合わず取り込まなかった行数。 */
  skipped: number
  total: number
  /** 取り込んだファイルの schemaVersion（migration 前）。 */
  sourceVersion: number
}

export type ImportRejection = 'format' | 'version' | 'corrupt'

export type ImportResult =
  | { status: 'ok'; report: ImportReport }
  | { status: 'invalid'; reason: ImportRejection }

/** 取り込む前に必ず通す封筒の検証。中身の各行はこのあとドメインのスキーマで見る。 */
const envelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string().nullable(),
  appVersion: z.string().nullable(),
  data: z.record(z.string(), z.array(z.unknown())),
})

const SCHEMAS: Record<CollectionName, z.ZodType> = {
  profile: profileSchema,
  sessions: sessionSchema,
  results: resultSchema,
  readingTests: readingTestSchema,
  recallTasks: recallTaskSchema,
  plans: planSchema,
  btrResults: btrResultSchema,
}

const emptyCounts = (): Record<CollectionName, number> => ({
  profile: 0,
  sessions: 0,
  results: 0,
  readingTests: 0,
  recallTasks: 0,
  plans: 0,
  btrResults: 0,
})

export interface ExportOptions {
  exportedAt: string
  appVersion: string
}

/** 保存済みの全レコードを書き出す。壊れた行も落とさずそのまま含める。 */
export async function exportSnapshot(
  store: RecordStore,
  options: ExportOptions,
): Promise<BackupSnapshot> {
  const data = {} as Record<CollectionName, unknown[]>
  for (const collection of COLLECTIONS) {
    data[collection] = await store.list(collection)
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: options.exportedAt,
    appVersion: options.appVersion,
    data,
  }
}

/**
 * バックアップから復元する。現在のデータは置き換える。
 *
 *   ファイル → version 判定 → migration → 封筒の検証 → 行ごとのドメイン検証 → 保存
 *
 * どの段でも落ちたら保存に進まない。手で編集されたファイルや別バージョンの
 * ファイルを読んでも、アプリが起動しなくなる状態にはしない。
 */
export async function importSnapshot(store: RecordStore, raw: unknown): Promise<ImportResult> {
  const sourceVersion = detectBackupVersion(raw)
  if (sourceVersion === null) return { status: 'invalid', reason: 'format' }
  // 未来の形式は落とす。知らない構造を推測で読むと、黙って壊れたデータが入る。
  if (sourceVersion > BACKUP_SCHEMA_VERSION) return { status: 'invalid', reason: 'version' }

  const migrated = migrateBackup(raw as RawSnapshot, sourceVersion)
  const envelope = envelopeSchema.safeParse(migrated)
  if (!envelope.success) return { status: 'invalid', reason: 'corrupt' }

  const restored = emptyCounts()
  let skipped = 0
  const accepted = {} as Record<CollectionName, StoredRecord[]>

  for (const collection of COLLECTIONS) {
    const rows = envelope.data.data[collection] ?? []
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
  return { status: 'ok', report: { restored, skipped, total, sourceVersion } }
}

/** ファイル名。同じ端末で複数回書き出しても上書きにならないよう日付を入れる。 */
export function backupFileName(exportedAt: string | null): string {
  const date = (exportedAt ?? '').slice(0, 10) || 'export'
  return `speed-reading-lab-backup-${date}.json`
}
