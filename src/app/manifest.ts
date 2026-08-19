import type { MetadataRoute } from 'next'

/**
 * ホーム画面に置いてオフラインで起動するための宣言。
 * アカウント登録が無いので、インストール直後からそのままトレーニングを始められる。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Speed Reading Lab',
    short_name: 'SR Lab',
    description:
      '速く理解し、必要な情報を選び、後から思い出せる能力を鍛える日本語速読トレーニング。オフラインで動作します。',
    lang: 'ja',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbfbfd',
    theme_color: '#16233d',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
