# Speed Reading Lab — Architecture

## 0. 前提：リポジトリの現状

調査時点（2026-08）の `Pkochiel/Pokochiel` 作業ブランチ `claude/speed-reading-lab-app-d38l6w` には次の3ファイルしか存在しない。

```
3min_networking.txt        (0 byte)
scrape_3min_networking.py  (無関係な旧タスクのスクレイパ)
scrape_to_pdf.py           (同上)
```

- `main` / `master` は存在せず、各ブランチが独立した別プロジェクトを持つサンドボックス型リポジトリ。
- README・package.json・CI 設定・Next.js 資産は**存在しない**。既存アプリケーションコードとの差分は「全て新規」。
- **既存の3ファイルは削除・改変しない。** アプリはリポジトリルートに構築し、これらは無関係な資産としてそのまま残す（`docs/` をルート直下に置く仕様に合わせるため、サブディレクトリ化しない）。

## 1. 技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| Framework | Next.js 16 (App Router) | RSC 前提。Route Handler は最小限 |
| Language | TypeScript strict | `any` 禁止。`noUncheckedIndexedAccess` 有効 |
| UI | React 19 | 状態管理ライブラリは導入しない |
| Styling | Tailwind CSS v4 | `@theme` でデザイントークン定義 |
| Components | 自前 primitives（Button / Card / Progress / Tabs 等） | shadcn/ui は必要が生じた時点で個別に導入 |
| Charts | 自前 SVG コンポーネント | recharts 等は入れない（数百行で足り、バンドルを汚さない） |
| Backend | Supabase（PostgreSQL / Auth / RLS） | Phase 2 以降 |
| Validation | zod | 教材データとフォーム入力の検証 |
| Unit Test | Vitest | `src/core` を中心に |
| E2E | Playwright | Chromium はこの環境にプリインストール済み |
| PWA | `app/manifest.ts` + 自前 Service Worker | `next-pwa` 等は使わない（Phase 5） |

バージョンは Step 3 の `package.json` 作成時に確定・固定する（調査時点の最新：next 16.3.1 / react 19.2.8 / tailwindcss 4.3.3 / vitest 4.1.11 / @playwright/test 1.62.1 / @supabase/supabase-js 2.112.3 / zod 4.4.3）。

**ライブラリ追加の判断基準：** 自前実装が 300 行未満で済み、かつ仕様が安定している領域には依存を足さない。

## 2. レイヤリング（最重要）

「Training Logic と UI を分離」を、ディレクトリ境界＋依存方向で機械的に強制する。

```
app/        ルーティングと構成のみ（薄く保つ）
  ↓
features/   画面単位の React 実装（UI・hooks・イベント処理）
  ↓
core/       純粋ドメインロジック（React 非依存・副作用なし・100% ユニットテスト対象）
  ↑
data/       教材コンテンツ／永続化（Repository 実装）— core の型に依存する
```

**依存ルール**

1. `core/` は React / Next.js / DOM / `window` / `Date.now()` を **import も参照もしない**。時刻は引数で受け取る。
2. `features/` → `core/` は可。`core/` → `features/` は不可。
3. `app/` にロジックを書かない。`app/` は `features/` の合成とデータ取得のみ。
4. `data/repositories` は `core/types` に依存してよいが、`core` から `data` は参照しない。

この 1. は「`src/core/**` に `react` / `next` / `window` / `document` の出現がないこと」を検証するユニットテスト（`core/__tests__/purity.test.ts`）で CI 上に固定する。純粋性が保たれる限り、Training Logic はブラウザなしで完全に検証できる。

## 3. ディレクトリ構造

```
/ (repo root = app root)
├─ docs/
│  ├─ PRODUCT.md
│  ├─ ARCHITECTURE.md
│  ├─ DATA_MODEL.md
│  ├─ TRAINING_LOGIC.md
│  └─ IMPLEMENTATION_PLAN.md
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                  # フォント / theme / metadata
│  │  ├─ page.tsx                    # /            Landing
│  │  ├─ globals.css                 # Tailwind v4 @theme トークン
│  │  ├─ manifest.ts                 # PWA (Phase 5)
│  │  ├─ (auth)/login/page.tsx       # /login
│  │  ├─ (app)/                      # ナビゲーション付きシェル
│  │  │  ├─ layout.tsx
│  │  │  ├─ onboarding/page.tsx
│  │  │  ├─ dashboard/page.tsx
│  │  │  ├─ progress/page.tsx
│  │  │  └─ settings/page.tsx
│  │  └─ (reading)/                  # distraction-free シェル（ナビなし）
│  │     ├─ layout.tsx
│  │     ├─ baseline/page.tsx
│  │     ├─ training/page.tsx        # 今日のセッションランナー
│  │     ├─ training/[type]/page.tsx # 単体トレーニング
│  │     └─ recall/page.tsx
│  ├─ core/                          # ← React 非依存
│  │  ├─ config/training-config.ts   # すべての閾値・係数（Magic Number 禁止の受け皿）
│  │  ├─ types/                      # domain types（passage / session / result / plan / skill）
│  │  ├─ metrics/                    # cpm / comprehension / recall / ers / baseline-profile
│  │  │                              #  / skill-profile / dashboard-stats / progress-series
│  │  ├─ training/                   # 各トレーニングの評価ロジック
│  │  │                              #  meaning-flash / prediction / variable-speed / regression
│  │  ├─ feedback/                   # 結果に対する助言の生成（AI 置換可能）
│  │  ├─ adaptive/                   # speed adaptation / training selection
│  │  ├─ planner/                    # daily training plan generation
│  │  ├─ scheduler/                  # next-day recall scheduling
│  │  ├─ chunking/                   # 日本語チャンク分割（levels / segment / merge）
│  │  └─ session/                    # セッション進行の状態遷移（純粋関数）
│  ├─ features/
│  │  ├─ baseline/ dashboard/ progress/ settings/ recall/
│  │  └─ training/
│  │     ├─ shared/                  # ReadingSurface / Pacer / TrainingHud / usePacer / useTimer
│  │     ├─ speed-push/ chunk-reading/ meaning-flash/ structure-reading/
│  │     ├─ prediction-reading/ variable-speed/ regression-control/
│  │     └─ comprehension/ immediate-recall/
│  ├─ data/
│  │  ├─ content/passages/*.ts       # 教材（唯一の正）
│  │  ├─ content/index.ts            # 読み出し + zod 検証
│  │  └─ repositories/               # ports & adapters（後述）
│  ├─ components/ui/                 # 汎用 primitives
│  └─ lib/                           # cn / format / date / supabase clients
├─ e2e/                              # Playwright
├─ supabase/
│  ├─ migrations/                    # SQL マイグレーション
│  └─ seed.sql                       # scripts から自動生成（手書きしない）
├─ scripts/generate-seed-sql.ts
└─ (既存) 3min_networking.txt, scrape_*.py   ← 触らない
```

ユニットテストは対象ファイルの隣に `*.test.ts` として置く（`core/metrics/cpm.test.ts` 等）。

## 4. 永続化：Ports & Adapters（Phase 1→2 の要）

Phase 1 は「ローカルで動く」ことが要件。Phase 2 で Supabase に載せ替える際に **UI を書き換えないため**、
永続化を最初からインタフェースで切る。

```ts
// src/data/repositories/types.ts
export interface TrainingRepository {
  getProfile(): Promise<Profile | null>
  saveProfile(p: ProfileInput): Promise<Profile>
  saveBaseline(r: BaselineResult): Promise<void>
  createSession(s: SessionInput): Promise<TrainingSession>
  completeSession(id: SessionId, at: Date): Promise<void>
  saveResult(r: TrainingResultInput): Promise<TrainingResult>
  listResults(range: DateRange): Promise<TrainingResult[]>
  getTodayPlan(date: LocalDate): Promise<DailyTrainingPlan | null>
  savePlan(plan: DailyTrainingPlan): Promise<void>
  listDueRecallTasks(date: LocalDate): Promise<RecallTask[]>
  scheduleRecallTask(t: RecallTaskInput): Promise<void>
  completeRecallTask(id: RecallTaskId, score: number, at: Date): Promise<void>
}
```

実装は2つ。

| 実装 | Phase | 保存先 |
|---|---|---|
| `LocalStorageRepository` | 1 | `localStorage`（バージョン付きキー `srl:v1:*`、zod で読み出し検証） |
| `SupabaseRepository` | 2 | PostgreSQL（RLS 前提） |

選択は `src/data/repositories/index.ts` の単一ファクトリで行い、環境変数 `NEXT_PUBLIC_SUPABASE_URL` の有無で切り替える。
Phase 2 では、ログイン時にローカルデータを一度だけ移送する `migrateLocalToRemote()` を用意する。

**教材コンテンツは Phase を問わず `src/data/content` が唯一の正。**
`scripts/generate-seed-sql.ts` が同じ TypeScript 定義から `supabase/seed.sql` を生成する（手書きの二重管理をしない）。

## 5. レンダリング戦略と状態管理

- Landing / Dashboard / Progress の**外枠**は Server Component。教材データは静的 import で RSC 上から渡す。
- トレーニング実行画面は全て Client Component（タイマー・キーボード・rAF が必要なため）。
- 外部 state 管理ライブラリは導入しない。粒度は次の3層のみ。
  1. コンポーネント内 `useState` / `useReducer`
  2. セッション進行は `core/session` の**純粋 reducer**（`(state, event) => state`）を `useReducer` で駆動 — これによりセッション進行のテストがブラウザ不要になる
  3. 横断的な設定・プロフィールは `ProfileProvider`（React Context）1つのみ

## 6. 計測エンジン（時間・ペーサー）

読書速度計測はこのアプリの根幹であり、精度要件を明示する。

- 経過時間は `performance.now()` で測る（`Date.now()` はシステム時刻変更の影響を受けるため使わない）。
- ペーサーの進行は `requestAnimationFrame` で行う（`setInterval` はドリフトする）。
- **`visibilitychange` でタイマーを一時停止する。** タブが隠れている間の時間は読書時間に算入しない。これがないと CPM が容易に汚染される。
- 計測対象は「Start 押下 → Finish 押下」の実測秒。ポーズ時間は差し引き、`pauseCount` として別途記録する。
- 実測秒が `MIN_READING_SECONDS` 未満のセッションは `invalid` としてフラグを立て、統計から除外する（誤タップ・スキップ対策）。

## 7. 日本語チャンク処理の方針

形態素解析器（kuromoji 等、辞書で数 MB〜）は MVP では導入しない。代わりに：

1. **教材側に文節境界を持たせる**（`chunks: string[]` を著者が定義）。これを分割の**原子単位**とする。
2. Chunk Level 1〜5 は「原子をいくつ結合するか」で表現する。文字数の窓に合わせて結合し、**意味単位の内部では絶対に割らない**。
3. 教材外の任意テキスト（将来のユーザー取り込み）に備え、ヒューリスティック分割器 `core/chunking/segment.ts` を用意する（句読点・助詞・文字種遷移ベース）。MVP では fallback 扱い。

これにより、辞書依存なしで日本語として自然なチャンク表示を実現しつつ、将来 kuromoji/AI に差し替える口を `Segmenter` インタフェースとして残す。

## 8. アクセシビリティと安全性

- Chunk Reading / Meaning Flash は文字が高速に明滅する。**光感受性発作のリスク帯（毎秒3回超の点滅）に入らないよう、チャンク表示時間に下限 250ms を設ける。**
- `prefers-reduced-motion` を尊重し、ペーサーのアニメーションをステップ表示に落とす設定を持つ。
- 本文表示はキーボードのみで完結する（Space / ← / → / Esc）。スマホでは画面下部の3ボタン。
- 文字サイズ・行間・テーマ（light/dark）は Settings で変更でき、`localStorage` に保存する。

## 9. テスト戦略

| レイヤ | ツール | 対象 |
|---|---|---|
| Unit | Vitest | `core/**`（CPM / ERS / difficulty adaptation / plan generation / recall scheduling / chunking / session reducer）と教材データの zod 検証 |
| Component | Vitest + Testing Library | Pacer / ReadingSurface など時間依存の少ない UI |
| E2E | Playwright | Baseline → Dashboard → Training → Result の完走 |

E2E は時間依存を避けるため、`?e2e=1` 時にトレーニング時間短縮とペーサー高速化を許すテストフック（`core/config` の値を上書きするだけ）を用意する。プロダクション経路には影響させない。

## 9-b. 差し替えを前提にしたインタフェース

将来 AI に置き換える箇所は、先にインタフェースとして切ってある。
実装を差し替えるだけで済み、UI と保存処理は変更しない。

| インタフェース | 現行の実装 | 将来 |
|---|---|---|
| `RecallEvaluator` | Key Point の照合（`keyPointRecallEvaluator`） | LLM による意味的一致度の評価 |
| `FeedbackGenerator` | ルールベース（`ruleBasedFeedback`） | AI Coach |
| `TrainingRepository` | `LocalStorageRepository` | `SupabaseRepository` |
| `ContentProvider`（予定） | Seed 教材の静的 import | AI 生成・ユーザー取り込み |

## 10. Phase 計画とアーキテクチャ上の対応

| Phase | 内容 | アーキテクチャ上の要点 |
|---|---|---|
| 1 | ローカルで動くトレーニング MVP | `LocalStorageRepository` のみ。Auth なし。教材は静的 import |
| 2 | ユーザーデータ保存 | `SupabaseRepository` 追加 + Auth + RLS。UI は無変更 |
| 3 | 適応型トレーニング | `core/adaptive` + `core/planner` を実データで駆動 |
| 4 | AI コンテンツ生成 / Recall 評価 | `Segmenter` と `RecallEvaluator` をインタフェース経由で差し替え |
| 5 | PWA・スマホ最適化 | `manifest.ts` + SW（教材と直近プランのオフラインキャッシュ） |

**Phase 1.5（完了）：** 認知処理の各段を鍛えるトレーニングと測定品質。
Skill Profile を導入し、Daily Training の構成を Skill Profile から決めるようにした。
永続化・認証・PWA・AI には手を付けていない。

**将来拡張（MVP では実装しない）：** ユーザー自身の Web 記事 / PDF / Kindle メモ / Obsidian ノートの取り込み。
`PassageSource` 型（`seed` | `imported` | `generated`）と `ContentProvider` インタフェースだけ先に定義し、取り込み実装の追加でアーキテクチャが揺れないようにしておく。
