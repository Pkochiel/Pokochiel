import Constants from 'expo-constants'

/**
 * 表示する Web アプリの URL。
 *
 * 値は app.config.ts の extra.webAppUrl だけで決める。iOS の App-Bound Domains も
 * 同じ値から作っているので、ここで別の URL を持つと iOS で開けなくなる。
 */
export const WEB_APP_URL = readWebAppUrl()

/** アプリの中で開くオリジン。これ以外はブラウザなどへ回す。 */
export const WEB_APP_ORIGIN = new URL(WEB_APP_URL).origin

function readWebAppUrl(): string {
  const value: unknown = Constants.expoConfig?.extra?.webAppUrl
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('app.config.ts の extra.webAppUrl が設定されていません')
  }
  return value
}

export interface Palette {
  readonly background: string
  readonly surface: string
  readonly text: string
  readonly muted: string
  readonly accent: string
  readonly accentText: string
}

/**
 * 色。Web アプリのトークン（../src/app/globals.css）と同じ値にする。
 *
 * background は viewport.themeColor（../src/app/layout.tsx）と同じ。
 * ノッチと下端のセーフエリアをこの色で塗るので、ずれるとそこだけ色が変わって見える。
 */
export const PALETTES: Readonly<Record<'light' | 'dark', Palette>> = {
  light: {
    background: '#fbfbfd',
    surface: '#ffffff',
    text: '#0b1220',
    muted: '#5b6474',
    accent: '#2563eb',
    accentText: '#ffffff',
  },
  dark: {
    background: '#0a0e16',
    surface: '#121826',
    text: '#e8ecf3',
    muted: '#9aa4b6',
    accent: '#5b8def',
    accentText: '#08101f',
  },
}

/**
 * User-Agent の末尾に付ける名前。
 *
 * Web アプリの側から「アプリ版の中で開かれているか」を見分けられるようにしておく。
 * アプリ版でだけ動きを変えたくなったとき（書き出しをネイティブに渡すなど）の足がかり。
 */
export const USER_AGENT_SUFFIX = `SRLabApp/${Constants.expoConfig?.version ?? 'dev'}`
