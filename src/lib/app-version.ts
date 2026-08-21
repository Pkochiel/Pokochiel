/**
 * ビルド時に埋め込まれるアプリの版。
 *
 * package.json の version を next.config.ts が注入する。
 * バックアップファイルに記録して、「どの版で書き出したか」を後から追えるようにする。
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0-dev'

/**
 * ビルドごとに変わる識別子。Service Worker のキャッシュ名に使う。
 * 版が同じでも中身が変われば別のキャッシュになる。
 */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'

/**
 * 配信されるパスの接頭辞。GitHub Pages のようにサブパスで配る場合に入る。
 * 通常の起動では空文字。
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** URL の末尾にスラッシュが付く構成か（静的書き出し時）。 */
export const TRAILING_SLASH = process.env.NEXT_PUBLIC_TRAILING_SLASH === '1'
