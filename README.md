# Speed Reading Lab

読む速度を上げるのではなく、**「速く理解し、必要な情報を選び、後から思い出せる能力」**を鍛える
日本語ファーストの速読トレーニング Web アプリ。

```
高速視認 → 意味認識 → 構造化 → 重要度判断 → 速度切替 → 理解 → 想起 → 長期記憶
```

## ステータス

**Phase 1（MVP）/ Phase 1.5（Training Core Enhancement）/ Phase 2（Local First）/
Phase 2.5（Release Hardening）完了。**

Baseline Test → Daily Training → 翌日 Recall → Progress まで一連で完了でき、
9つの認知能力（Skill Profile）を独立に測定して、その日の構成を自動で決める。

**アカウント登録もインターネット接続も要らない。** 記録は端末内の IndexedDB にだけ保存され、
オフラインでも起動・トレーニング・保存・翌日 Recall がそのまま動く。
端末外へ出したいときは Settings から JSON で書き出す。Auth・クラウド同期・AI は未実装。

**鍛えるトレーニング**

| Training | 鍛える認知能力 |
|---|---|
| Speed Push | Reading Speed |
| Chunk Reading | Chunk Recognition |
| Meaning Flash | Meaning Extraction |
| Structure Reading | Structure Recognition |
| Prediction Reading | Prediction |
| Variable Speed Reading | Adaptive Reading |
| Regression Control | 無駄な読み戻りの抑制 |
| Comprehension Test | Comprehension |
| Immediate / Next-day Recall | Immediate / Delayed Recall |

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

node scripts/generate-icons.mjs   # PWA アイコンを作り直す
```

## 起動できないとき

| 症状 | 原因と対処 |
|---|---|
| 画面は出るが「構成を準備しています…」から進まない | JS チャンクの取得に失敗している。DevTools の Network で `/_next/static/chunks/*.js` が 200 か確認する |
| dev で `/_next/*` が 403 になる | dev サーバーは既定で localhost 以外からの要求を拒否する。`next.config.ts` の `allowedDevOrigins` に開きたいホスト（LAN の IP 等）を足す |
| 一部のチャンクだけ 404 / 500 | サーバーを動かしたまま `npm run build` した。**サーバーを止めてからビルドし直す** |
| `Port 3000 is in use` | 前のサーバーが残っている。ターミナルを閉じるか `npx next start -p 3210` で別ポートを使う |
| `ERR_CONNECTION_REFUSED` | サーバーが起動していない。ターミナルに `✓ Ready` が出ているか確認する |

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | コンセプト・非目標・指標・MVP スコープ・DoD |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技術スタック・レイヤリング・永続化（Local First）・PWA |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | ドメイン型・IndexedDB / localStorage スキーマ・移送・Backup 形式 |
| [docs/PERSISTENCE.md](docs/PERSISTENCE.md) | Repository / RecordStore / migration / backup / 将来の Sync Engine |
| [docs/RELEASE.md](docs/RELEASE.md) | CI・build・test・PWA キャッシュ更新・スキーマ変更の手順 |
| [docs/TRAINING_LOGIC.md](docs/TRAINING_LOGIC.md) | CPM / ERS / 速度適応 / プラン生成 / Recall スケジューリング / チャンク分割 |
| [docs/METRICS.md](docs/METRICS.md) | CPM / Comprehension / Recall / Skill Profile / ERS / 有効・無効判定の定義 |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Step 1–15 の実装順と各 Step の完了条件 |

## 技術スタック

Next.js 16 (App Router) / React 19 / TypeScript strict / Tailwind CSS v4 /
IndexedDB / Service Worker (PWA) / zod / Vitest / Playwright

クラウド同期（Supabase）は将来の任意機能。足す場合も、同期が無い状態で全機能が動くことは変えない。

## 注意

リポジトリ直下の `3min_networking.txt` および `scrape_*.py` は本プロジェクトとは無関係な既存ファイルであり、変更しない。
