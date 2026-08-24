import { readFileSync } from 'node:fs'
import type { NextConfig } from 'next'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

/**
 * ビルドごとに変わる ID。Service Worker のキャッシュ名に使い、
 * 新しいビルドを配ったときに古い JS / CSS を確実に破棄させる。
 * CI 等で固定したい場合は BUILD_ID を渡す。
 */
const buildId = process.env.BUILD_ID ?? `${pkg.version}-${Date.now().toString(36)}`

/**
 * GitHub Pages 向けの静的書き出し。
 *
 * このアプリはサーバー処理を持たない（全ページ静的・データは端末内の IndexedDB）ため、
 * そのまま静的ホスティングに載る。Pages はリポジトリ名のサブパスで配信されるので
 * basePath を付け、拡張子なしの URL でも引けるよう trailingSlash を有効にする。
 * 通常の開発・本番起動（next dev / next start）はこの分岐に入らない。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const staticExport = process.env.STATIC_EXPORT === 'true'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * dev サーバーは既定で localhost 以外からの /_next/* 要求を 403 で拒否する。
   * http://127.0.0.1:3000 で開いたときにアセットだけが落ちて画面が動かなくなるため、
   * IP 形式も許可する。LAN の別端末から開くときは、その IP をここに足す。
   * （本番の next start にはこの制限はない）
   */
  allowedDevOrigins: ['127.0.0.1'],
  typescript: { ignoreBuildErrors: false },
  ...(staticExport
    ? { output: 'export' as const, trailingSlash: true, basePath, assetPrefix: basePath }
    : {}),
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_TRAILING_SLASH: staticExport ? '1' : '0',
  },
}

export default nextConfig
