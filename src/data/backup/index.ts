import { getPersistentStore } from '@/data/persistence'
import {
  exportSnapshot,
  importSnapshot,
  type BackupSnapshot,
  type ImportResult,
} from './snapshot'

export type { BackupSnapshot, ImportReport, ImportResult } from './snapshot'
export { backupFileName, BACKUP_FORMAT, BACKUP_VERSION } from './snapshot'

/**
 * バックアップの境界。
 *
 * UI はこのインタフェースだけを見る。保存先が IndexedDB であることも、
 * collection の構造も、画面側には出さない。
 */
export interface BackupService {
  createSnapshot(): Promise<BackupSnapshot>
  restoreSnapshot(raw: unknown): Promise<ImportResult>
}

export function getBackupService(): BackupService {
  return {
    createSnapshot: () => exportSnapshot(getPersistentStore(), new Date().toISOString()),
    restoreSnapshot: (raw) => importSnapshot(getPersistentStore(), raw),
  }
}
