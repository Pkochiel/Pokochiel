/**
 * WebView の中で何を開くかの判断。
 *
 * React Native に依存しない形にしてあり、単体で試せる。
 */

export type NavigationDecision =
  /** WebView の中で開く */
  | 'load'
  /** 端末のブラウザや、その URL を扱うアプリに任せる */
  | 'open-externally'
  /** どこにも開かない */
  | 'block'

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** アプリの中のページか。同じオリジンの http(s) だけをそう扱う。 */
export function isAppPage(url: string, appOrigin: string): boolean {
  const parsed = parse(url)
  if (parsed === null) return false
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  return parsed.origin === appOrigin
}

/**
 * トップフレームの遷移をどう扱うか。
 *
 * **オリジンは文字列の前方一致で比べない。** react-native-webview の originWhitelist は
 * 前方一致の正規表現なので、`https://example.com` を許すと
 * `https://example.com.evil.test` まで WebView の中で開いてしまう。
 *
 * **blob: と data: は開かない。** バックアップの書き出しは blob: の URL を
 * `<a download>` で開くが、WebView はそれをダウンロードとして扱えず、ページ遷移になる。
 * 通すと JSON の中身が画面全体に出て、アプリの画面が消える。
 * blob: の origin は作ったページの origin と同じになる（URL の仕様）ので、
 * origin だけを見るとここを素通りする。protocol を先に見ているのはそのため。
 */
export function decideNavigation(url: string, appOrigin: string): NavigationDecision {
  const parsed = parse(url)
  if (parsed === null) return 'block'

  switch (parsed.protocol) {
    case 'https:':
    case 'http:':
      return parsed.origin === appOrigin ? 'load' : 'open-externally'
    // WebView が初期化のときに通る。
    case 'about:':
      return 'load'
    case 'blob:':
    case 'data:':
    case 'javascript:':
    case 'file:':
      return 'block'
    // mailto: や tel: など。対応するアプリに任せる。
    default:
      return 'open-externally'
  }
}

/**
 * 引っ張って更新させない画面。
 *
 * 種目・組み立て・速度の計測・想起テストは、途中の状態を画面の中にしか持っていない。
 * 再読み込みするとその回が消え、90分の組み立ての後半なら全部やり直しになる。
 * スクロールを戻そうとして指が下へ滑っただけで起こるので、これらの画面では無効にする。
 *
 * 配信先によっては URL の頭にサブパス（GitHub Pages の /<repo>/ など）が付くので、
 * パスの先頭には固定しない。
 */
const PATHS_WITHOUT_PULL_TO_REFRESH: readonly RegExp[] = [
  // 種目（/btr/saccade/）と組み立て（/btr/session/90/）。一覧（/btr/）は含めない。
  /\/btr\/[^/]+/,
  // 速度の計測。説明だけの /baseline/ は含めない。
  /\/baseline\/read(\/|$)/,
  // 想起テスト
  /\/recall(\/|$)/,
]

export function allowsPullToRefresh(url: string): boolean {
  const parsed = parse(url)
  // 分からないときは更新させない。更新できないことより、回が消えることのほうが重い。
  if (parsed === null) return false
  return !PATHS_WITHOUT_PULL_TO_REFRESH.some((pattern) => pattern.test(parsed.pathname))
}
