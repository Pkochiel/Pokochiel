'use client'

import { useIsOffline } from './use-online-status'

/**
 * オフライン時の状態表示。
 *
 * 「使えなくなった」ではなく「このまま続けられる」ことを伝える。
 * 全機能がローカルで完結するので、実際に止まる操作は無い。
 */
export function OfflineBadge() {
  const offline = useIsOffline()
  if (!offline) return null

  return (
    <p
      role="status"
      className="mb-4 rounded-xl border border-border bg-surface-muted px-4 py-2 text-xs text-fg-muted"
    >
      <span className="font-medium text-fg">オフライン</span>
      ：トレーニング・記録・翌日の Recall はこのまま続けられます。
    </p>
  )
}
