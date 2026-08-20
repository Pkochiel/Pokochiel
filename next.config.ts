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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
}

export default nextConfig
