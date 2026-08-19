# Speed Reading Lab — Implementation Plan

仕様の実装順（Step 1〜15）に沿う。各 Step の完了時に `Done / Changed / Test Result / Next` を報告する。
**一度に全機能を実装しない。** 各 Step は「調査 → 設計 → 実装 → テスト → 修正」で閉じる。

## Phase 1 — ローカルで動くトレーニング MVP

### Step 1: プロジェクト構造確認 ✅ 完了
- リポジトリ調査済み。既存は無関係な Python スクリプト3件のみ（削除・改変しない）。
- ツールチェーン確認済み：Node 22.22 / npm 10.9 / pnpm 10.33 / Chromium プリインストール / npm registry 到達可。

### Step 2: Architecture 設計 ✅ 完了
- `docs/PRODUCT.md` / `ARCHITECTURE.md` / `DATA_MODEL.md` / `TRAINING_LOGIC.md` / `IMPLEMENTATION_PLAN.md`

### Step 3: Next.js 基本 UI ✅ 完了
- `package.json`（Next 16 / React 19 / TS strict / Tailwind v4 / Vitest / Playwright / zod）
- `tsconfig.json`（`strict`, `noUncheckedIndexedAccess`, path alias `@/*`）
- デザイントークン（White / Black / Navy / Blue / Gray + アクセント1色）、light/dark
- ルート骨格：`/`(Landing) `/dashboard` `/training` `/progress`、`(app)` と `(reading)` の2シェル
- `components/ui`：Button / Card / Progress / Stat / Tabs
- **完了条件**：`npm run build` 成功、`npm run lint` クリーン、4画面が PC/スマホ幅で崩れない
- 結果：build 成功（12 ルート）/ lint・typecheck クリーン / unit 8 passed / E2E 6 passed（desktop・mobile 両方で横スクロール 0px）

### Step 4: Seed Training Content ✅ 完了
- `src/data/content/passages/*.ts` を **20〜30本**（最低10本）。全てオリジナル日本語文章。著作物の転載なし
- 各教材：本文 / 段落 / `chunks`（意味単位）/ `keyPoints` 3–5 / 設問5問以上（4種以上・inference 必須）/ `estimatedDifficulty`
- zod スキーマ + データ検証テスト（`characterCount` の一致、設問種別カバレッジ、chunks の結合が本文と一致すること）
- **完了条件**：`content.test.ts` が全教材で green
- 結果：26本 / 計11,536字 / 難易度 d1:2 d2:7 d3:9 d4:6 d5:2 / 全7カテゴリ / 検証 399 assertions green
- 本文は「意味単位（チャンク）の配列」として執筆し、content・characterCount・chunks はそこから導出する（二重管理と境界の食い違いを構造的に排除）

### Step 5: Baseline Reading Test ✅ 完了
- `/baseline`：Start → 計測 → Finished → 理解度5問 → Recall（3–5項目）→ 初期スコア確定
- `performance.now()` 計測、`visibilitychange` でポーズ、`valid` 判定
- 結果を `LocalStorageRepository` に保存し、`baseline_cpm` / `target_cpm` を確定
- **完了条件**：CPM / Comprehension / Recall / Structure の初期値が Dashboard に反映される
- 結果：`/baseline/read` の全フロー（読書 → 理解度5問 → Recall → 結果）が動作。E2E 14 passed / unit 563 passed
- 併せて実装：`core/metrics/{cpm,comprehension,recall,ers,dashboard-stats}`、`core/session/{timer,baseline-flow}`、`core/scheduler/recall-schedule`、`core/util/date`、`LocalStorageRepository`
- 計測の妥当性：3秒未満・6000CPM超は `valid=false` とし、基準値を汚染しない（理由別のメッセージを表示）

### Step 6: Speed Push ✅ 完了
- ペーサー（ライン / ハイライト / ガイドバー）を `requestAnimationFrame` で駆動
- 初期速度 `baseline × 1.15`、理解度に応じた `adaptSpeed`
- **完了条件**：`core/adaptive/speed.test.ts` green、速度が設定レンジ内に収まる

### Step 7: Chunk Reading ✅ 完了
- Level 1–5、表示時間下限 250ms、`prefers-reduced-motion` 対応
- 意味単位を割らない分割ロジック
- **完了条件**：`core/chunking/segment.test.ts` green

### Step 8: Structure Reading ✅ 完了
- 段落ごとに「結局この段落は何を言っている？」を選択式で回答
- **完了条件**：段落要旨の正答率が Structure 軸に反映される

### Step 9: Comprehension Test ✅ 完了
- 5種の設問タイプ、0–100 スコア、解説表示
- **完了条件**：スコアが速度適応に接続される

### Step 10: Recall ✅ 完了
- Immediate Recall（テキスト確定 → Key Points 表示 → 自己評価）
- `scheduleRecallTasks` で翌日タスク生成、`/recall` で翌日実施
- **完了条件**：`core/scheduler/recall-schedule.test.ts` green、翌日タスクが Dashboard に出る

### Step 11: Dashboard Metrics ✅ 完了
- Current CPM / Comprehension / Immediate Recall / Next-day Recall / Streak
- Progress：7 / 30 / 90 日切替、自前 SVG チャート（Speed / Comprehension / Recall）
- Skill Radar のスコアは算出・保存（描画は後続でよい）
- **完了条件**：E2E `Baseline → Dashboard → Training → Result` が完走（＝ MVP DoD）
- 結果：Baseline / Daily Training / Progress / Settings の E2E が desktop・mobile で 21 passed（Daily Training は所要時間の都合で desktop のみ）
- チャートは自前 SVG。系列色は CVD 分離・明度帯・コントラストを検証したうえで light / dark 別に選定（`--chart-1` / `--chart-2`）
- 色に頼らない代替として、各チャートに表形式の内訳を用意

## Phase 1.5 — 適応型トレーニング ✅ 完了

### Adaptive Training
- `generateDailyPlan` を実データで駆動、10/20/30 分の切替 ✅
- 弱点に応じた配分変更（Recall 低下時は速度を落とさず配分を変える）✅
- 未実測の軸を弱点と誤認しない（新規ユーザーには標準構成）✅
- 供出元はベース配分の半分を保持し、特定のトレーニングが消えないようにする ✅
- 残り：`generated_reason` を Dashboard に短文で提示（Step 11 で対応）

## Phase 2 — Local First / Offline ✅ 完了

目的：**インターネット接続・アカウント登録なしで、Training / Progress / Recall がすべて使える。**
Auth と Supabase は入れない。クラウド同期が無い状態で全機能が完結することを要件とする。

### Step 12: 保存先の抽象化と IndexedDB ✅ 完了
- `RecordStore` ポートを追加し、`TrainingRepository` の実装を保存技術から切り離した
  （インタフェースは Phase 1 から無変更）
- `IndexedDbRecordStore` / `LocalStorageRecordStore` / `MemoryRecordStore` が同じ契約テストを通る
- IndexedDB が使えない環境では localStorage に退避し、トレーニングを止めない
- 記録は `createdAt` 昇順で返す（保存先の並び順を指標に混ぜない）
- **完了条件**：IndexedDB 固有処理が UI / Core / Repository に無いことをテストで固定 ✅

### Step 13: 移送と Backup ✅ 完了
- 起動時に `srl:v1:*` を IndexedDB へ移送し、旧キーを削除（移動であって複製ではない）
- Settings から JSON Export / Import。復元は zod 検証を通してから置き換える
- **完了条件**：Phase 1 のデータを持つ端末が、記録を失わずに Phase 2 で起動できる ✅

### Step 14: PWA / オフライン起動 ✅ 完了
- `app/manifest.ts` + アイコン生成（`scripts/generate-icons.mjs`・依存なし）
- Service Worker：主要画面と、その HTML が参照する JS / CSS を install 時に取り込む
- トレーニング画面を `generateStaticParams` で静的出力
- **完了条件**：ネットワークを切った状態で起動・保存・翌日 Recall ができる ✅
  （`e2e/offline.spec.ts`）

## Phase 3 — Supabase Sync（任意機能）

同期は「あると便利」であって、必須にはしない。ローカルへの書き込みを先に確定させ、
同期は後追いにする。差し込み位置は `RecordStore` のデコレータ 1 箇所（ARCHITECTURE.md §4-3）。

### Step 15: Sync Engine
- `SyncingRecordStore`（ローカル確定 → 変更を積む → 接続時に送る）
- 競合解決の方針（更新時刻の新しい方を採る／記録は削除しない）
- **完了条件**：同期を無効にしても全機能が変わらず動く

## Phase 4 — AI 機能

MVP 完成後に着手する。インタフェースは先に用意済み。

- AI Training Content Generator（`ContentProvider`）
- AI Recall Evaluation（`RecallEvaluator`：蓄積済み `recall_text` を再スコアリング）
- AI Coach（`generated_reason` を自然文コーチングに変換）

## 横断ルール

- TypeScript strict、`any` を安易に使わない、Component を巨大化させない
- Training Logic（`core/`）と UI（`features/`）を分離し、`core/` の React 非依存を purity テストで固定
- Magic Number は `training-config.ts` に集約
- 各 Step 完了時に `Done / Changed / Test Result / Next` を報告する
