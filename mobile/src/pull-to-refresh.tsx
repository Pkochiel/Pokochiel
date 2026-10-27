import type { ReactNode } from 'react'
import { Platform, RefreshControl, ScrollView, StyleSheet } from 'react-native'
import type { Palette } from './config'

interface PullToRefreshProps {
  /** 引っ張りを受けるか。WebView が一番上にいて、しかも更新してよい画面のときだけ true。 */
  readonly enabled: boolean
  readonly refreshing: boolean
  readonly onRefresh: () => void
  readonly palette: Palette
  readonly children: ReactNode
}

/**
 * Android の引っ張って更新。
 *
 * react-native-webview の pullToRefreshEnabled は iOS にしか効かない
 * （14.0.1 の Android 側の setter は中身が空）。Android では RefreshControl で包む。
 *
 * RefreshControl は「中身がもう上へスクロールできないか」を見て引っ張りを横取りするが、
 * 中に入れた WebView のスクロール位置までは見えない。そのままだとページの途中で
 * 下へ引いただけで更新されてしまうので、WebView が一番上にいるときだけ enabled にする
 * （位置は呼ぶ側が WebView の onScroll から決める）。
 *
 * iOS では何も包まない。WebView 自身の UIRefreshControl を使う。
 */
export function PullToRefresh({
  enabled,
  refreshing,
  onRefresh,
  palette,
  children,
}: PullToRefreshProps) {
  if (Platform.OS !== 'android') return children

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.fill}
      // 外側の ScrollView は引っ張りを受けるためだけにある。スクロールは WebView に任せる。
      // ここが動くと、WebView の縦スクロールを横取りしてページが動かなくなる。
      scrollEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          enabled={enabled}
          colors={[palette.accent]}
          progressBackgroundColor={palette.surface}
        />
      }
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
