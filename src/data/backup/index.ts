import { getPersistentStore } from '@/data/persistence'
import { APP_VERSION } from '@/lib/app-version'
import { exportSnapshot, importSnapshot, type BackupSnapshot, type ImportResult } from './snapshot'

export type { BackupSnapshot, ImportReport, ImportRejection, ImportResult } from './snapshot'
export { backupFileName, BACKUP_FORMAT, BACKUP_SCHEMA_VERSION } from './snapshot'

/**
 * バックアップの境界。
 *
 * UI はこのインタフェースだけを見る。collection の構造も、保存先が
 * IndexedDB であることも、バックアップの version 変換も画面側には出さない。
 */
export interface BackupService {
  createSnapshot(): Promise<BackupSnapshot>
  restoreSnapshot(raw: unknown): Promise<ImportResult>
}

export function getBackupService(): BackupService {
  return {
    createSnapshot: () =>
      exportSnapshot(getPersistentStore(), {
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
      }),
    restoreSnapshot: (raw) => importSnapshot(getPersistentStore(), raw),
  }
}
