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
| 永続化 | IndexedDB（自前の薄いラッパー） | `idb` 等は入れない。使う API が限られており、`persistence/indexeddb/` に閉じている |
| Backend | なし（Local First） | クラウド同期は将来の任意機能。無くても全機能が動く |
| Validation | zod | 教材データとフォーム入力の検証 |
| Unit Test | Vitest | `src/core` を中心に |
| E2E | Playwright | Chromium はこの環境にプリインストール済み |
| PWA | `app/manifest.ts` + 自前 Service Worker | `next-pwa` 等は使わない（ビルド生成物に手を入れない） |

バージョンは `package.json` で固定する（next 16.3.1 / react 19.2.8 / tailwindcss 4.3.3 / vitest 4.1.11 /
@playwright/test 1.62.1 / zod 4.4.3）。テスト用に `fake-indexeddb` のみ devDependency として追加している
（IndexedDB の代替実装を自前で書くと 300 行では収まらないため）。

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
│  │  ├─ layout.tsx                  # フォント / theme / metadata / SW 登録
│  │  ├─ page.tsx                    # /            Landing
│  │  ├─ globals.css                 # Tailwind v4 @theme トークン
│  │  ├─ manifest.ts                 # PWA マニフェスト
│  │  ├─ icon.svg / apple-icon.png   # アイコン（scripts/generate-icons.mjs が生成）
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
│  │  ├─ content/passages/*.ts       # 教材（唯一の正・静的 import でオフライン可）
│  │  ├─ content/index.ts            # 読み出し + zod 検証
│  │  ├─ repositories/               # TrainingRepository（ドメイン規則 + zod 検証）
│  │  ├─ persistence/                # RecordStore ポートと保存先アダプタ
│  │  │  ├─ record-store.ts          #   ポート定義
│  │  │  ├─ memory-store.ts          #   メモリ（SSR / テスト）
│  │  │  ├─ local-storage-store.ts   #   localStorage（移送元 / 代替保存先）
│  │  │  ├─ indexeddb/               #   IndexedDB（ここだけが IDB を知る）
│  │  │  │  ├─ idb.ts                #     Promise 化した薄いラッパー
│  │  │  │  ├─ migrations.ts         #     version ごとのスキーマ migration
│  │  │  │  └─ indexeddb-store.ts    #     RecordStore の実装
│  │  │  ├─ legacy-migration.ts      #   Phase 1 データの移送
│  │  │  └─ create-store.ts          #   保存先を決める唯一の場所
│  │  └─ backup/                     # JSON Export / Import
│  │     ├─ migrations.ts            #   旧 backup を現行形式へ
│  │     └─ snapshot.ts              #   検証つきの取り込み・書き出し
│  ├─ components/ui/                 # 汎用 primitives
│  └─ lib/                           # cn / format / date / app-version
├─ .github/workflows/ci.yml          # typecheck / lint / unit / build / E2E
├─ e2e/                              # Playwright（helpers/storage.ts で保存内容を検証）
├─ public/
│  ├─ sw.js                          # Service Worker（オフライン起動）
│  └─ icon-192.png / icon-512.png    # PWA アイコン
├─ scripts/generate-icons.mjs        # アイコン生成（依存なし・node:zlib のみ）
└─ (既存) 3min_networking.txt, scrape_*.py   ← 触らない
```

ユニットテストは対象ファイルの隣に `*.test.ts` として置く（`core/metrics/cpm.test.ts` 等）。

## 4. 永続化：Local First

Phase 2 の要件は「インターネット接続とアカウント登録なしで、Training / Progress / Recall が
すべて使えること」。**クラウド同期が存在しない前提で全機能が完結する。**

> スキーマ migration・backup の version 管理・耐久性テストを含む詳細は
> **[docs/PERSISTENCE.md](PERSISTENCE.md)** にまとめている。ここでは層の関係だけを示す。

### 4-1. 層構成

```
features / core                      ← 保存技術を知らない
      ↓
TrainingRepository                   ← ドメインの言葉（Phase 1 から変えていない）
      ↓
RecordStore                          ← 「id を持つレコードを collection に置く」だけの下位ポート
      ↓
IndexedDbRecordStore / LocalStorageRecordStore / MemoryRecordStore
```

| 層 | 責務 | 知っていること |
|---|---|---|
| `TrainingRepository` | 既定値・重複排除・期限切れ・時系列整列・zod 検証 | ドメイン型 |
| `RecordStore` | レコードの出し入れ（list / get / put / putMany / remove / clear） | id と collection だけ |
| アダプタ | 保存技術そのもの | IndexedDB / localStorage / メモリ |

- `TrainingRepository` の**シグネチャは Phase 1 から一切変えていない**。全メソッドが最初から
  `Promise` を返していたため、同期の localStorage から非同期の IndexedDB へ移っても UI は無変更。
- `RecordStore` はドメイン型を持たない（`unknown` を返す）。検証は Repository の zod が行うので、
  ドメインの変更が保存層に波及しない。
- `RecordStore` は**順序を保証しない**。IndexedDB は id 順で返すため、Repository が `createdAt`
  昇順に整列する。trend 判定・直近 N 件・最新 Baseline は並び順に意味を持たせており、
  保存先の都合を指標に混ぜないため。
- **IndexedDB 固有の型と API は `src/data/persistence/indexeddb/` の外に出さない。**
  UI・Core Domain・Repository のいずれにも漏らさないことを
  `src/data/__tests__/persistence-encapsulation.test.ts` が機械的に固定する。

### 4-2. 起動時に決めること

`createLocalFirstStore()`（`persistence/create-store.ts`）が、初回アクセス時に一度だけ行う。

1. IndexedDB を開く。開けない環境（プライベートモード等）や 3 秒で応答が無い場合は
   **localStorage の実装に退避する**。保存先が理想的でなくてもトレーニングは止めない。
2. Phase 1 の `srl:v1:*` に記録が残っていれば IndexedDB へ移送し、旧キーを削除する。
   移送は id 単位の upsert なので、途中で中断されても次の起動でやり直せる。

この 2 つを `DeferredRecordStore` の内側に閉じることで、`getRepository()` は同期関数のまま保てる
（呼び出し側は Repository のメソッドを await するだけでよい）。

### 4-3. 将来の Supabase Sync を差し込む位置

```
TrainingRepository
      ↓
RecordStore  ←── SyncingRecordStore（デコレータ）を 1 枚挟むだけ
      ↓                    ↓
IndexedDbRecordStore   Sync Engine ──→ Supabase
```

ローカルへの書き込みを先に確定させ、同期はその後ろで行う（オフラインで書けなくならないため）。
差し込み位置は `createLocalFirstStore()` の 1 箇所であり、UI・Core・Repository は変更しない。
`RecordStore` が id 単位の upsert で構成されているのは、この差分同期を後から足せるようにするため。

### 4-4. Backup / Restore

アカウントを作らない代わりに、記録を端末の外へ出す手段はユーザーが握る。

| 操作 | 内容 |
|---|---|
| Export | 全 collection を 1 つの JSON（`speed-reading-lab.backup` / version 1）として書き出す |
| Import | 形式とバージョンを確認し、**全行を zod で検証してから**現在のデータを置き換える |

`BackupService`（`src/data/backup/`）が境界。UI は `createSnapshot()` / `restoreSnapshot()` だけを
知り、collection 構造も IndexedDB も見ない。検証に通らない行は取り込まず件数を報告する
（手で編集されたファイルでアプリが起動しなくなる状態を作らない）。

**教材コンテンツは Phase を問わず `src/data/content` が唯一の正。**
静的 import なので、オフラインでも取得の失敗が起きない。

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

## 8-b. PWA とオフライン起動

Service Worker（`public/sw.js`）は**起動できることだけ**を担う。学習記録の永続化には関与しない
（それは IndexedDB の責務であり、2 箇所で状態を持たない）。

| 対象 | 方針 | 理由 |
|---|---|---|
| 画面遷移 | ネットワーク優先 → キャッシュ → Dashboard | 更新を見逃さず、切断時も必ず何かを出す |
| `/_next/static/**` | キャッシュ優先 | ファイル名にハッシュが入るため中身が変わらない |
| その他の同一オリジン GET | キャッシュを返しつつ裏で更新 | 表示を止めない |

install 時に主要画面（Dashboard / Training / 各トレーニング / Progress / Recall / Settings /
Baseline）を取得し、**その HTML が参照している JS・CSS も HTML から読み取って**一緒に取り込む。
HTML だけではオフラインで画面が動かないため。トレーニング画面は `generateStaticParams` で
静的出力し、オフラインでも開けるようにしている。

### 更新戦略

Service Worker は `/sw.js?build=<BUILD_ID>` として登録する（`BUILD_ID` はビルド時に埋め込む）。

- 新しいビルドを配ると登録 URL が変わり、install → activate が走る
- activate で**このビルド以外の `srl-` キャッシュをすべて削除**する。
  古い JS / CSS が residue として残らない
- HTML と JS の不整合は、HTML をネットワーク優先にすること、および
  HTML をキャッシュするときに参照先の JS / CSS も併せて取り込むことで防ぐ
- トレーニング中に画面が飛ばないよう、更新検知による自動リロードは行わない

Service Worker は本番ビルドでのみ登録する（開発中はキャッシュが変更の確認を妨げるため）。
オフライン時は画面上部に「オフライン：トレーニング・記録・翌日の Recall はこのまま続けられます」と
表示する。止まったのではなく、そのまま使えることを伝える。

手順とチェックリストは [docs/RELEASE.md](RELEASE.md)。

## 9. テスト戦略

| レイヤ | ツール | 対象 |
|---|---|---|
| Unit | Vitest | `core/**`（CPM / ERS / difficulty adaptation / plan generation / recall scheduling / chunking / session reducer）と教材データの zod 検証 |
| Component | Vitest + Testing Library | Pacer / ReadingSurface など時間依存の少ない UI |
| E2E | Playwright | Baseline → Dashboard → Training → Result の完走、オフライン起動・保存・復元 |
| 層の封じ込め | Vitest | `core/` の純粋性（`purity.test.ts`）と、保存技術が UI / Core / Repository に漏れていないこと（`persistence-encapsulation.test.ts`） |
| 耐久性 | Vitest | アプリ更新・Backup 往復・migration 失敗・保存先の退避で学習データが失われないこと（`durability.test.ts`） |

CI（`.github/workflows/ci.yml`）が PR ごとに typecheck / lint / unit / build と smoke E2E を、
統合ブランチへの push で full E2E を回す。詳細は [docs/RELEASE.md](RELEASE.md)。

E2E は時間依存を避けるため、`?e2e=1` 時にトレーニング時間短縮とペーサー高速化を許すテストフック（`core/config` の値を上書きするだけ）を用意する。プロダクション経路には影響させない。

## 9-b. 差し替えを前提にしたインタフェース

将来 AI に置き換える箇所は、先にインタフェースとして切ってある。
実装を差し替えるだけで済み、UI と保存処理は変更しない。

| インタフェース | 現行の実装 | 将来 |
|---|---|---|
| `RecallEvaluator` | Key Point の照合（`keyPointRecallEvaluator`） | LLM による意味的一致度の評価 |
| `FeedbackGenerator` | ルールベース（`ruleBasedFeedback`） | AI Coach |
| `TrainingRepository` | `RecordStoreRepository` | 変更しない（保存先の差し替えは下位で行う） |
| `RecordStore` | `IndexedDbRecordStore`（代替: localStorage / メモリ） | `SyncingRecordStore` + Supabase |
| `BackupService` | 端末内の JSON Export / Import | クラウドバックアップ |
| `ContentProvider`（予定） | Seed 教材の静的 import | AI 生成・ユーザー取り込み |

## 10. Phase 計画とアーキテクチャ上の対応

| Phase | 内容 | アーキテクチャ上の要点 |
|---|---|---|
| 1 | ローカルで動くトレーニング MVP | localStorage のみ。Auth なし。教材は静的 import |
| 1.5 | Training Core Enhancement | Skill Profile を導入し、Daily Training の構成を Skill Profile から決める |
| 2 | Local First / Offline | `RecordStore` ポート + IndexedDB。PWA でオフライン起動。Backup / Restore。Auth と Supabase は入れない |
| 2.5 | Release Hardening | CI・スキーマ migration・backup の version 管理・SW の更新戦略。データ構造を変えても既存の記録が壊れない土台 |
| 3 | Supabase Sync（任意機能） | `SyncingRecordStore` を 1 枚挟む。同期が無くても全機能が動く状態は維持する |
| 4 | AI コンテンツ生成 / Recall 評価 | `ContentProvider` と `RecallEvaluator` をインタフェース経由で差し替え |

**Phase 2（完了）：** 保存先を IndexedDB に移し、PWA でオフライン起動できるようにした。
Auth と Supabase は入れていない。クラウドが存在しない状態で全機能が完結することを要件とし、
E2E（`e2e/offline.spec.ts`）でネットワークを切った状態の起動・保存・翌日 Recall を確認している。

**Phase 2.5（完了）：** 変更を安全に配るための土台。GitHub Actions での自動検証、
IndexedDB の version migration、backup の schemaVersion、ビルド単位の SW キャッシュ。
新機能ではなく「今後の変更で既存ユーザーの記録と PWA を壊さない」ための整備。

**同期を後から足すときの原則：** ローカルへの書き込みを先に確定させ、同期は後追いにする。
同期が失敗してもトレーニングが止まらないことを、常に優先する。

**将来拡張（MVP では実装しない）：** ユーザー自身の Web 記事 / PDF / Kindle メモ / Obsidian ノートの取り込み。
`PassageSource` 型（`seed` | `imported` | `generated`）と `ContentProvider` インタフェースだけ先に定義し、取り込み実装の追加でアーキテクチャが揺れないようにしておく。
