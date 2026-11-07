export const BACKUP_FORMAT = 'speed-reading-lab.backup'

/** 現在書き出す形式の version。形が変わるたびに 1 つ上げる。 */
export const BACKUP_SCHEMA_VERSION = 2

/** 検証前の、形の定まっていないバックアップ。 */
export type RawSnapshot = Record<string, unknown>

export interface BackupMigration {
  /** この migration を適用し終えた時点の schemaVersion。 */
  readonly toVersion: number
  readonly description: string
  readonly migrate: (snapshot: RawSnapshot) => RawSnapshot
}

/**
 * 旧バックアップを現在の形へ持ち上げる並び。**追記のみ。**
 *
 * ユーザーが持っているファイルは書き換えられない以上、
 * 「昔の形を読める」ことはアプリ側の責務として永続的に残す。
 */
export const BACKUP_MIGRATIONS: readonly BackupMigration[] = [
  {
    toVersion: 2,
    description: 'version → schemaVersion、collections → data、appVersion を追加',
    migrate: (snapshot) => ({
      format: BACKUP_FORMAT,
      schemaVersion: 2,
      exportedAt: typeof snapshot.exportedAt === 'string' ? snapshot.exportedAt : null,
      appVersion: null,
      // collections が無いファイルは既定値で埋めない。空とみなすと
      // 「壊れたファイルの取り込み」が「全消去」になってしまう。
      data: snapshot.collections,
    }),
  },
]

/**
 * ファイルの schemaVersion を読む。
 * 当アプリのバックアップでなければ null（＝受け付けない）。
 */
export function detectBackupVersion(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null) return null
  const snapshot = raw as RawSnapshot
  if (snapshot.format !== BACKUP_FORMAT) return null
  if (typeof snapshot.schemaVersion === 'number') return snapshot.schemaVersion
  // v1 は version というフィールド名だった
  if (typeof snapshot.version === 'number') return snapshot.version
  return null
}

/** fromVersion から現在の形まで、必要な migration だけを順に適用する。 */
export function migrateBackup(
  snapshot: RawSnapshot,
  fromVersion: number,
  migrations: readonly BackupMigration[] = BACKUP_MIGRATIONS,
  toVersion: number = BACKUP_SCHEMA_VERSION,
): RawSnapshot {
  return migrations
    .filter((migration) => migration.toVersion > fromVersion && migration.toVersion <= toVersion)
    .sort((a, b) => a.toVersion - b.toVersion)
    .reduce((current, migration) => migration.migrate(current), snapshot)
}
