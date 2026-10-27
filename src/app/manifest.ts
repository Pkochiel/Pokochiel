import type { MetadataRoute } from 'next'
import { BASE_PATH, TRAILING_SLASH } from '@/lib/app-version'

/** 静的書き出し（GitHub Pages 配信）でも生成できるようにする。 */
export const dynamic = 'force-static'

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
    start_url: `${BASE_PATH}/dashboard${TRAILING_SLASH ? '/' : ''}`,
    scope: `${BASE_PATH}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbfbfd',
    theme_color: '#16233d',
    categories: ['education', 'productivity'],
    icons: [
      { src: `${BASE_PATH}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${BASE_PATH}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: `${BASE_PATH}/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
