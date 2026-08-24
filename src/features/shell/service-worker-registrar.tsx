'use client'

import { useEffect } from 'react'
import { BASE_PATH, BUILD_ID, TRAILING_SLASH } from '@/lib/app-version'

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
      const query = `build=${encodeURIComponent(BUILD_ID)}&trailing=${TRAILING_SLASH ? '1' : '0'}`
      void navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js?${query}`, { scope: `${BASE_PATH}/` })
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
