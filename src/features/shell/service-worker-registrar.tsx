'use client'

import { useEffect } from 'react'
import { BUILD_ID } from '@/lib/app-version'

/**
 * Service Worker を登録する。
 *
 * 目的は「ネットワークが無くても起動できること」だけ。
 * 学習記録の保存には関与しない（それは IndexedDB 側の責務）。
 * 開発中は登録しない（キャッシュが変更の確認を邪魔するため）。
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    // ビルドごとに URL を変える。新しいビルドを配ると install → activate が走り、
    // 旧ビルドのキャッシュ（古い JS / CSS）が activate で破棄される。
    const register = () => {
      void navigator.serviceWorker
        .register(`/sw.js?build=${encodeURIComponent(BUILD_ID)}`, { scope: '/' })
        .catch(() => {
          // 登録できなくてもアプリは動く（オンライン時と同じ挙動になるだけ）。
        })
    }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
