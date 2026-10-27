import { isRunningInExpoGo } from 'expo'
import { StatusBar } from 'expo-status-bar'
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, Linking, Platform, StyleSheet, useColorScheme } from 'react-native'
import { type Edge, SafeAreaView } from 'react-native-safe-area-context'
import { WebView, type WebViewNavigation, type WebViewProps } from 'react-native-webview'
import { PALETTES, USER_AGENT_SUFFIX, WEB_APP_ORIGIN, WEB_APP_URL } from './config'
import { allowsPullToRefresh, decideNavigation, isAppPage } from './navigation-policy'
import { PullToRefresh } from './pull-to-refresh'
import { ErrorView, LoadingView } from './status-views'

// パッケージの入口から公開されていない型は、props の型から取り出す。
type ShouldStartLoadRequest = Parameters<
  NonNullable<WebViewProps['onShouldStartLoadWithRequest']>
>[0]
type ScrollEvent = Parameters<NonNullable<WebViewProps['onScroll']>>[0]

/**
 * WebView の実体の型。
 *
 * react-native-webview の WebView は `WebView<P = undefined>` という総称型で、props が
 * `WebViewProps & P` になる。`useRef<WebView>` と書くと P が既定の undefined に決まり、
 * ref から推論された props が never になって、どの props も渡せなくなる。
 */
type WebViewHandle = WebView<object>

/**
 * 四辺ともセーフエリアの内側に収める。
 *
 * Web アプリは下端のナビゲーションだけ env(safe-area-inset-bottom) で避けているが、
 * 上端の帯（種目の残り時間など）は避けていない。WebView を画面いっぱいに広げると
 * ノッチの下に潜るので、ネイティブ側で内側に収める。WebView がセーフエリアと重ならなく
 * なるので、ページの中の env(safe-area-inset-*) は 0 になり、二重に空くことはない。
 */
const EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left']

/** 遷移の判定は onShouldStartLoadWithRequest に一本化する（originWhitelist は前方一致で甘い）。 */
const ALL_ORIGINS = ['*']

/**
 * iOS で App-Bound Domains に絞るか。
 *
 * 絞ると WKWebView の中でも Service Worker が動き、オフラインで起動できる。
 * 宣言（Info.plist の WKAppBoundDomains）は自分でビルドしたアプリにしか入らず、
 * Expo Go の Info.plist には無い。宣言の無いアプリで絞ったときの振る舞いに頼らず、
 * Expo Go では絞らない（そのかわり Expo Go ではオフライン起動できない）。
 */
const LIMIT_TO_APP_BOUND_DOMAINS = !isRunningInExpoGo()

/**
 * Web アプリを画面いっぱいに表示する。
 *
 *   セーフエリア        ノッチと下端を避け、その帯を Web アプリの背景色で塗る
 *   引っ張って更新      iOS は WebView 自身、Android は RefreshControl。種目の途中では無効
 *   戻る               iOS は端からのスワイプ、Android は戻るボタン（戻れなければアプリを閉じる）
 *   アプリの外のリンク   ブラウザや対応するアプリで開く
 *   WebView の異常終了  iOS は読み込み直し、Android は作り直す
 */
export function WebAppScreen() {
  const palette = PALETTES[useColorScheme() === 'dark' ? 'dark' : 'light']
  const webViewRef = useRef<WebViewHandle>(null)

  // WebView を作り直すときは key を変える。作り直した WebView はこの URL から開く。
  const [instance, setInstance] = useState({ key: 0, url: WEB_APP_URL })
  const source = useMemo(() => ({ uri: instance.url }), [instance.url])

  // いま開いているアプリ内のページ。更新してよいかの判断と、作り直すときの戻り先に使う。
  const [currentUrl, setCurrentUrl] = useState(WEB_APP_URL)
  const [canGoBack, setCanGoBack] = useState(false)

  // Android の引っ張って更新に使う。iOS は WebView が自分で持っている。
  const [atTop, setAtTop] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const pullToRefreshAllowed = allowsPullToRefresh(currentUrl)

  useAndroidBackButton(webViewRef, canGoBack)

  const restart = useCallback((url: string) => {
    setInstance((current) => ({ key: current.key + 1, url }))
    setCanGoBack(false)
    setAtTop(true)
    setRefreshing(false)
  }, [])

  const handleShouldStartLoad = useCallback((request: ShouldStartLoadRequest) => {
    // iframe の中の遷移には口を出さない。isTopFrame は iOS だけが渡す
    // （Android は undefined なので、トップフレームとして扱う）。
    if (request.isTopFrame === false) return true

    const decision = decideNavigation(request.url, WEB_APP_ORIGIN)
    if (decision === 'open-externally') {
      Linking.openURL(request.url).catch((error: unknown) => {
        console.warn(`この URL を開けるアプリがありません: ${request.url}`, error)
      })
    }
    return decision === 'load'
  }, [])

  // SPA の画面遷移（history.pushState）でも呼ばれる。iOS は react-native-webview が
  // history を差し込んで、Android は doUpdateVisitedHistory で通知している。
  const handleNavigationStateChange = useCallback((navigation: WebViewNavigation) => {
    setCanGoBack(navigation.canGoBack)
    if (isAppPage(navigation.url, WEB_APP_ORIGIN)) setCurrentUrl(navigation.url)
  }, [])

  const handleScroll = useCallback((event: ScrollEvent) => {
    setAtTop(event.nativeEvent.contentOffset.y < 1)
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    webViewRef.current?.reload()
  }, [])

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: palette.background }]} edges={EDGES}>
      <StatusBar style="auto" />
      <PullToRefresh
        enabled={pullToRefreshAllowed && atTop}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        palette={palette}
      >
        <WebView
          key={instance.key}
          ref={webViewRef}
          source={source}
          // 読み込み前の下地。既定の白のままだと、ダークモードで一瞬白く光る。
          style={[styles.fill, { backgroundColor: palette.background }]}
          originWhitelist={ALL_ORIGINS}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onNavigationStateChange={handleNavigationStateChange}
          applicationNameForUserAgent={USER_AGENT_SUFFIX}
          startInLoadingState
          renderLoading={() => <LoadingView palette={palette} />}
          renderError={(_domain, _code, description) => (
            <ErrorView palette={palette} detail={description} onRetry={() => restart(currentUrl)} />
          )}
          // 成功でも失敗でも呼ばれる。Android の更新の印をここで消す。
          onLoadEnd={() => setRefreshing(false)}
          // ---- iOS ----
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled={pullToRefreshAllowed}
          limitsNavigationsToAppBoundDomains={LIMIT_TO_APP_BOUND_DOMAINS}
          // メモリが足りなくなると、裏に回っているあいだに WebView の中身だけが落とされる。
          // 戻ってきたときに真っ白にならないよう読み込み直す。
          onContentProcessDidTerminate={() => webViewRef.current?.reload()}
          // ---- Android ----
          onScroll={Platform.OS === 'android' ? handleScroll : undefined}
          // レンダラが落ちた WebView は二度と使えない（reload も効かない）。作り直す。
          onRenderProcessGone={() => restart(currentUrl)}
        />
      </PullToRefresh>
    </SafeAreaView>
  )
}

/**
 * Android の戻るボタン。
 *
 * WebView の中で戻れるうちは戻る。戻れなければ false を返して既定の動作
 * （アプリを閉じる）に任せる。戻れるかどうかは SPA の画面遷移でも更新される。
 */
function useAndroidBackButton(webViewRef: RefObject<WebViewHandle | null>, canGoBack: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false
      webViewRef.current?.goBack()
      return true
    })
    return () => subscription.remove()
  }, [webViewRef, canGoBack])
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
