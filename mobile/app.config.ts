import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Speed Reading Lab のアプリ版（WebView で Web アプリを包んだもの）の設定。
 *
 * 表示する Web アプリの URL はここだけで決める。アプリ本体は extra.webAppUrl を読み、
 * iOS の App-Bound Domains も同じ値から作る。二か所に書くとずれて、iOS で何も開けなくなる。
 *
 * 配信先を変えるときは環境変数で渡す:
 *
 *   WEB_APP_URL=https://<user>.github.io/<repo>/dashboard/ npx expo start
 *
 * リダイレクトされない最終的な URL を指定すること。別のオリジンへリダイレクトされると、
 * そこはアプリの外として扱われ、ブラウザへ回される。
 */
const DEFAULT_WEB_APP_URL = 'https://your-pwa-url.com'

function readWebAppUrl(): URL {
  const raw = process.env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`WEB_APP_URL を URL として読めません: ${raw}`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`WEB_APP_URL は http(s) の URL にしてください: ${raw}`)
  }
  return url
}

const webAppUrl = readWebAppUrl()

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SR Lab',
  slug: 'speed-reading-lab',
  version: '1.0.0',
  // Web アプリのマニフェスト（../src/app/manifest.ts）と同じく縦で固定する。
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Web アプリは端末のダークモードに従う。ここを light にすると、
  // WebView の中まで常にライトとして描かれる。
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    // 公開前に自分の識別子へ変える。
    bundleIdentifier: 'com.example.speedreadinglab',
    infoPlist: {
      // WKWebView で Service Worker を動かすための宣言（オフライン起動に要る）。
      // ここに挙げたドメインの外へは、WebView の中では遷移できなくなる。最大10件。
      WKAppBoundDomains: [webAppUrl.hostname],
    },
  },
  android: {
    // 公開前に自分の識別子へ変える。
    package: 'com.example.speedreadinglab',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  extra: {
    webAppUrl: webAppUrl.href,
  },
})
