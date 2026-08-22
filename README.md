# Speed Reading Lab

目を速く動かす訓練ではなく、**読んだ内容を保っていられる力**を鍛える
日本語ファーストの速読トレーニング Web アプリ。

BTRメソッド（Basic Training for Readers）に沿って作っている。
速読の中核はワーキングメモリであって、眼球運動の速さではない。
目標は実用的な **3倍**。「1分で1冊」「10倍20倍」は謳わない。

```
準備 → 認知視野の拡大 → 読書内容への集中 → 実際の読書
```

## ステータス

**Phase 1（MVP）/ Phase 1.5 / Phase 2（Local First）/ Phase 2.5（Release Hardening）/
Phase 3（BTRメソッドへの移行）完了。**

その日取れる長さ（90 / 45 / 30 / 15 分）を選ぶと、種目の組み合わせをアプリが決める。
**どの長さでもサッケイドと倍速読書は必ず入る。**
入口（眼）と出口（実際の読書）を欠くと、その日が何のためだったか分からなくなるため。

級は「課される制限時間の短さ」で上がり、**種目ごとに独立**している。
推移は総合点をひとつ出すのではなく、種目ごとの数字を並べる。

**アカウント登録もインターネット接続も要らない。** 記録は端末内の IndexedDB にだけ保存され、
オフラインでも起動・トレーニング・保存・翌日 Recall がそのまま動く。
端末外へ出したいときは Settings から JSON で書き出す。Auth・クラウド同期・AI は未実装。

**種目**

| 段階 | 種目 |
|---|---|
| 準備 | カウント呼吸法 |
| 認知視野の拡大 | サッケイド（たて・よこ）/ 数字ランダム / ユニットブック / 漢数字一行 / BPシート |
| 読書内容への集中 | スピードチェック / かなひろい / ロジカルテスト / スピードボード / イメージ記憶 |
| 読書 | 普通読書 / 倍速読書（自分の本を読む） |

読書だけは用意された文章ではなく **自分の本** を使う。
本を登録するときに1ページの文字数を入れてもらい、読んだページ数から分速を出す。

翌日の想起（Recall）は BTR に対応する種目がないが、記憶の定着を見る補助として残してある。

## データの扱い

| | |
|---|---|
| 保存先 | 端末内の IndexedDB（使えない環境では localStorage に退避） |
| 送信 | しない。サーバーへ記録を送る経路が存在しない |
| 移行 | Phase 1 の `srl:v1:*`（localStorage）は初回起動時に自動で移送し、旧キーを削除する |
| 持ち出し | Settings → 「JSON を書き出す」／「バックアップから復元」 |
| 消去 | ブラウザのサイトデータ削除で完全に消える（バックアップを取ってから行う） |

## 開発

```bash
npm install
npm run dev      # 開発サーバ（Service Worker は登録しない）
npm run check    # typecheck + lint + unit test
npm run e2e:smoke # Playwright（PR で回すぶん・30秒程度）
npm run e2e:full  # Playwright（統合時に回すぶん・5分程度）

# GitHub Pages と同じ静的書き出しを手元で作る
STATIC_EXPORT=true NEXT_PUBLIC_BASE_PATH=/Pokochiel npm run build   # → out/

node scripts/generate-icons.mjs   # PWA アイコンを作り直す
```

## 触ってみる（インストール不要）

`main` 相当の開発ブランチへ push すると、GitHub Actions が静的書き出しして GitHub Pages へ配信する。

```
https://pkochiel.github.io/Pokochiel/
```

Node.js もターミナルも要らない。PC・スマホのどちらのブラウザからも開け、
PWA としてホーム画面に追加すればオフラインでも動く。
記録は開いた端末のブラウザ内（IndexedDB）にだけ残り、端末間では共有されない。

> 配信が始まらない場合は、リポジトリの Settings → Pages → Source を
> **GitHub Actions** にする（一度だけ）。

## 起動できないとき

| 症状 | 原因と対処 |
|---|---|
| 画面は出るが「今日の組み立てを用意しています…」から進まない | JS チャンクの取得に失敗している。DevTools の Network で `/_next/static/chunks/*.js` が 200 か確認する |
| dev で `/_next/*` が 403 になる | dev サーバーは既定で localhost 以外からの要求を拒否する。`next.config.ts` の `allowedDevOrigins` に開きたいホスト（LAN の IP 等）を足す |
| 一部のチャンクだけ 404 / 500 | サーバーを動かしたまま `npm run build` した。**サーバーを止めてからビルドし直す** |
| `Port 3000 is in use` | 前のサーバーが残っている。ターミナルを閉じるか `npx next start -p 3210` で別ポートを使う |
| `ERR_CONNECTION_REFUSED` | サーバーが起動していない。ターミナルに `✓ Ready` が出ているか確認する |

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [docs/BTR_METHOD.md](docs/BTR_METHOD.md) | BTRメソッドの調査と設計。確認できたこと・推測でしかないことを分けてある |
| [docs/PRODUCT.md](docs/PRODUCT.md) | コンセプト・非目標・指標・スコープ・DoD |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技術スタック・レイヤリング・永続化（Local First）・PWA |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | ドメイン型・IndexedDB / localStorage スキーマ・移送・Backup 形式 |
| [docs/PERSISTENCE.md](docs/PERSISTENCE.md) | Repository / RecordStore / migration / backup / 将来の Sync Engine |
| [docs/RELEASE.md](docs/RELEASE.md) | CI・build・test・PWA キャッシュ更新・スキーマ変更の手順 |
| [docs/TRAINING_LOGIC.md](docs/TRAINING_LOGIC.md) | BTR の外に残っている部分（CPM / Recall / 設定の置き場所 / テスト一覧） |
| [docs/METRICS.md](docs/METRICS.md) | 種目ごとの記録・推移の向き・読書の倍率・有効／無効判定の定義 |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | 実装順と各段の完了条件 |

## 技術スタック

Next.js 16 (App Router) / React 19 / TypeScript strict / Tailwind CSS v4 /
IndexedDB / Service Worker (PWA) / zod / Vitest / Playwright

クラウド同期（Supabase）は将来の任意機能。足す場合も、同期が無い状態で全機能が動くことは変えない。

## 注意

リポジトリ直下の `3min_networking.txt` および `scrape_*.py` は本プロジェクトとは無関係な既存ファイルであり、変更しない。
