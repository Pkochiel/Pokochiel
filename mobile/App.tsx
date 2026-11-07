import { SafeAreaProvider } from 'react-native-safe-area-context'
import { WebAppScreen } from './src/web-app-screen'

/**
 * Speed Reading Lab のアプリ版。
 *
 * 画面はすべて Web アプリ（リポジトリ直下の Next.js）が描く。ここで持つのは
 * WebView の外側の振る舞い（セーフエリア・引っ張って更新・戻る）だけ。
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <WebAppScreen />
    </SafeAreaProvider>
  )
}
