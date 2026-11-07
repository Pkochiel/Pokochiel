# Speed Reading Lab — アプリ版

配信中の Web アプリ（リポジトリ直下の Next.js）を WebView で全画面に表示する Expo アプリ。
画面はすべて Web アプリが描く。ここで持つのは WebView の外側の振る舞いだけ。

| | |
|---|---|
| Expo SDK | 58（React Native 0.88） |
| WebView | react-native-webview 14.0.1 |
| ルーティング | なし（画面は WebView 1枚。ネイティブの画面を足すときに Expo Router を入れる） |

## 表示する URL

`app.config.ts` の1か所で決める。既定値は仮の `https://your-pwa-url.com`。環境変数で渡す。

```bash
WEB_APP_URL=https://<user>.github.io/<repo>/dashboard/ npx expo start
```

- GitHub Pages（`.github/workflows/pages.yml`）で配信しているなら、URL はこの形になる
- ホーム画面版（PWA）と同じ画面から始めるなら、末尾に `/dashboard/` を付ける
- **リダイレクトされない最終的な URL** にする。別のオリジンへリダイレクトされると、
  そこはアプリの外として扱われ、ブラウザへ回される
- iOS の App-Bound Domains（後述）も、この URL のホスト名から作られる

## 起動

```bash
npm install
npx expo start          # Expo Go で開く
```

Expo Go で確かめられるのは、表示・セーフエリア・引っ張って更新・戻る・外部リンク。
**iOS のオフライン起動だけは Expo Go では確かめられない**（下の App-Bound Domains を参照）。

自分でビルドする（development build）:

```bash
npx expo run:ios        # macOS と Xcode が要る
npx expo run:android    # Android SDK が要る
# 手元に環境がなければ EAS:  npx eas-cli@latest build --profile development
```

`ios/` と `android/` は `npx expo prebuild` が `app.config.ts` から作る（Continuous Native Generation）。
手で編集せず、コミットもしない。

## 対応していること

| | iOS | Android |
|---|---|---|
| 全画面表示 | 四辺をセーフエリアの内側に収め、ノッチと下端の帯を Web アプリの背景色で塗る | 同左 |
| 引っ張って更新 | WebView の `pullToRefreshEnabled` | `RefreshControl` で WebView を包む |
| 戻る | 画面の端からのスワイプ | 戻るボタン。戻れなければアプリを閉じる |
| アプリ外のリンク | ブラウザ・対応するアプリで開く | 同左 |
| WebView の異常終了 | 読み込み直す（裏に回っているあいだに落とされると真っ白になるため） | WebView を作り直す |
| 読み込みに失敗 | 再読み込みのボタンを出す | 同左 |

### 引っ張って更新を切る画面

種目（`/btr/<種目>/`）・組み立て（`/btr/session/<分>/`）・速度の計測（`/baseline/read/`）・
想起テスト（`/recall/`）では無効にしている。途中の状態は画面の中にしかないので、
再読み込みするとその回が消える。90分の組み立ての後半なら全部やり直しになる。
判定は `src/navigation-policy.ts`。

### App-Bound Domains（iOS）

WKWebView で Service Worker を動かすには、`Info.plist` の `WKAppBoundDomains` に
ドメインを宣言し、WebView 側でもそれに絞る必要がある。これが無いと、
一度開いたあとでも圏外では起動できない。

宣言は自分でビルドしたアプリにしか入らない。Expo Go の `Info.plist` には無いので、
Expo Go では絞らずに開く（その代わりオフライン起動はできない）。

## 気をつけること

### 記録はブラウザ版とは別に保存される

WebView の保存領域はアプリごとに分かれている。ブラウザやホーム画面版で積んだ記録・級は、
アプリ版からは見えない。移すには、ブラウザ版の設定画面の「JSON を書き出す」で JSON を作り、
アプリ版の設定画面の「バックアップから復元」で読み込む。逆向き（アプリ版から外へ）は、
次の理由でいまはできない。

### バックアップの書き出しはアプリ版では動かない

Web アプリは `<a download>` で blob: の URL を開いて JSON を保存させるが、WebView は
それをダウンロードとして扱えない（iOS はページ遷移になり、Android は DownloadManager が
blob: を受け付けない）。そのまま通すと JSON の中身が画面全体に出てアプリの画面が消えるので、
アプリ版ではこの遷移を止めてある（`src/navigation-policy.ts`）。**ボタンを押しても何も起きない。**

直すには Web とネイティブの橋渡しが要る。Web 側で `window.ReactNativeWebView` があれば
JSON を `postMessage` で渡し、ネイティブ側で `expo-file-system` に書いて `expo-sharing` で
共有シートを出す、という形になる。アプリ版の User-Agent には `SRLabApp/<版>` を付けてあるので、
Web 側でアプリ版かどうかを見分けられる。

### 実機で確かめていないこと

- Android でキーボードが下端の入力欄を隠さないか（イメージ記憶の解答欄など）。
  SDK 58 の Android は edge-to-edge が前提で、キーボードが出たときの画面の縮み方が以前と違いうる
- Android の引っ張って更新の手触り（RefreshControl で包む方式）
- iOS で一度開いたあと、機内モードで起動し直せるか（Service Worker）
- バックアップの取り込み（ファイル選択の画面が出るか）

## 公開する前に

- `app.config.ts` の `bundleIdentifier` / `package`（いまは仮の `com.example.speedreadinglab`）
- アイコン（`assets/` は Expo の雛形のまま）
- `WEB_APP_URL`

## 検証

```bash
npm run check           # 型・lint・単体テスト
```
