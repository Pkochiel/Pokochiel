'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * オフラインかどうか。
 * サーバー描画時は false（＝表示しない）。オフライン表示は補足であり、
 * 機能の可否には影響しない。
 */
export function useIsOffline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  )
}
