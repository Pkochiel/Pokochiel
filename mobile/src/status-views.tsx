import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Palette } from './config'

/**
 * 最初の読み込みのあいだ WebView に重ねる。
 *
 * 重ねないと、ダークモードでも WebView の白い下地が一瞬見える。
 */
export function LoadingView({ palette }: { palette: Palette }) {
  return (
    <View style={[styles.overlay, { backgroundColor: palette.background }]}>
      <ActivityIndicator color={palette.accent} />
    </View>
  )
}

interface ErrorViewProps {
  readonly palette: Palette
  /** WebView が返した説明。通信ではなく設定の誤りだったときの手がかりになる。 */
  readonly detail: string
  readonly onRetry: () => void
}

/**
 * 読み込めなかったとき。
 *
 * 初めての起動を圏外でしたときにここへ来る。一度開けば、そのあとは Service Worker の
 * キャッシュから起動できる（iOS は自分でビルドしたアプリだけ。Expo Go ではできない）。
 */
export function ErrorView({ palette, detail, onRetry }: ErrorViewProps) {
  return (
    <View style={[styles.overlay, styles.padded, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>ページを開けませんでした</Text>
      <Text style={[styles.body, { color: palette.muted }]}>
        通信できる状態か確かめて、もう一度読み込んでください。
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: palette.accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.buttonLabel, { color: palette.accentText }]}>もう一度読み込む</Text>
      </Pressable>
      {detail.length > 0 ? (
        <Text style={[styles.detail, { color: palette.muted }]}>{detail}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // react-native-webview は読み込み中・失敗の画面を WebView と並べて置く。
  // 全面に重ねないと、WebView と画面を半分ずつ取り合う。
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padded: {
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  detail: {
    marginTop: 24,
    fontSize: 12,
    textAlign: 'center',
  },
})
