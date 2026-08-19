'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { backupFileName, getBackupService, type ImportReport } from '@/data/backup'

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'exported'; count: number }
  | { kind: 'restored'; report: ImportReport }
  | { kind: 'error'; message: string }

const INVALID_MESSAGES: Record<'format' | 'version', string> = {
  format: 'このファイルは Speed Reading Lab のバックアップではありません。',
  version: 'このバックアップは対応していない形式です。',
}

/** 生成した Blob を保存させる。DOM 操作はこの層に閉じる。 */
function downloadJson(fileName: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // 取得が始まる前に無効化しないよう、破棄は次のタスクで行う
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * 記録の書き出しと復元。
 *
 * アカウントを作らない代わりに、端末の外へ出す手段をユーザーが握る。
 * 機種変更・ブラウザのデータ削除で学習履歴を失わないための唯一の出口。
 */
export function BackupPanel() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const fileInput = useRef<HTMLInputElement>(null)

  const exportData = async () => {
    setStatus({ kind: 'working' })
    try {
      const snapshot = await getBackupService().createSnapshot()
      const count = Object.values(snapshot.collections).reduce((sum, rows) => sum + rows.length, 0)
      downloadJson(backupFileName(snapshot.exportedAt), JSON.stringify(snapshot, null, 2))
      setStatus({ kind: 'exported', count })
    } catch {
      setStatus({ kind: 'error', message: '書き出しに失敗しました。' })
    }
  }

  const restore = async (file: File) => {
    setStatus({ kind: 'working' })
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      setStatus({ kind: 'error', message: 'ファイルを読み取れませんでした。' })
      return
    }

    const outcome = await getBackupService().restoreSnapshot(parsed)
    if (outcome.status === 'invalid') {
      setStatus({ kind: 'error', message: INVALID_MESSAGES[outcome.reason] })
      return
    }
    setStatus({ kind: 'restored', report: outcome.report })
  }

  return (
    <Card>
      <CardHeader
        title="データのバックアップ"
        description="記録はこの端末の中だけに保存されています。機種変更やブラウザのデータ削除に備えて、ファイルとして書き出せます。"
      />

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={status.kind === 'working'}
          onClick={() => void exportData()}
        >
          JSON を書き出す
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={status.kind === 'working'}
          onClick={() => fileInput.current?.click()}
        >
          バックアップから復元
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="バックアップファイル"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void restore(file)
          }}
        />
      </div>

      <p className="mt-3 text-xs text-fg-subtle">
        復元すると、いまこの端末にある記録は書き出したときの内容に置き換わります。
      </p>

      <div aria-live="polite" className="mt-3 text-sm">
        {status.kind === 'exported' ? (
          <p className="text-positive">{status.count} 件の記録を書き出しました。</p>
        ) : null}
        {status.kind === 'restored' ? (
          <div className="space-y-2">
            <p className="text-positive">
              {status.report.total} 件を復元しました。
              {status.report.skipped > 0
                ? `（読み取れなかった ${status.report.skipped} 件は除外しました）`
                : ''}
            </p>
            <Button type="button" size="sm" onClick={() => window.location.reload()}>
              画面を更新して反映する
            </Button>
          </div>
        ) : null}
        {status.kind === 'error' ? <p className="text-negative">{status.message}</p> : null}
      </div>
    </Card>
  )
}
