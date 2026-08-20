# Speed Reading Lab — Data Model

Phase 1（localStorage）と Phase 2（Supabase / PostgreSQL）で**同一のドメイン型**を使う。
以下の TypeScript 型が正であり、SQL はその射影である。

## 1. ドメイン型（`src/core/types`）

```ts
export type TrainingType =
  | 'warmup' | 'speed_push' | 'chunk_reading' | 'meaning_flash'
  | 'structure_reading' | 'prediction_reading' | 'variable_speed'
  | 'regression_control' | 'comprehension' | 'immediate_recall' | 'delayed_recall'

export type PassageCategory =
  | 'business' | 'technology' | 'economics' | 'psychology'
  | 'science' | 'history' | 'general'

export type Difficulty = 1 | 2 | 3 | 4 | 5           // 1 Beginner … 5 Expert
export type QuestionType = 'main_idea' | 'detail' | 'cause_effect' | 'inference' | 'structure'
export type PassageSource = 'seed' | 'imported' | 'generated'   // 将来拡張の口

/** 予測の質。完全一致ではなく論理方向で評価する */
export type PredictionQuality = 'correct' | 'partial' | 'miss'

export interface TrainingPassage {
  id: string
  title: string
  category: PassageCategory
  difficulty: Difficulty
  source: PassageSource
  content: string                 // 本文（日本語）
  characterCount: number          // 空白・改行を除いた実文字数（導出値だが検証のため保持）
  estimatedDifficulty: DifficultyFactors   // 難易度の内訳（§4）
  keyPoints: string[]             // Recall の模範ポイント 3〜5件
  paragraphs: PassageParagraph[]  // Structure Reading 用
  chunks: string[]                // 文節/意味単位の原子（Chunk Reading 用）
  questions: TrainingQuestion[]
}

export interface PassageParagraph {
  index: number
  text: string
  /** この段落を構成する意味単位。ペーサー表示で段落構造を保つ */
  chunks: string[]
  /** 「結局この段落は何を言っている？」の正解と誤答 */
  summaryChoices: { id: string; text: string; correct: boolean }[]
  /** Prediction Reading の停止位置。choices を持つ教材だけが対象になる */
  predictionStop?: {
    prompt: string
    expectedPoints: string[]
    choices?: { id: string; text: string; quality: PredictionQuality; explanation: string }[]
  }
  /**
   * Variable Speed Reading の情報価値。本文を二重に持たないよう、区間は段落単位で定義する。
   * 全段落に付いている教材だけが Variable Speed の対象になる。
   */
  importance?: 'known' | 'example' | 'evidence' | 'claim' | 'key'
  recommendedBand?: 'fast' | 'normal' | 'slow'
}

export interface TrainingQuestion {
  id: string
  passageId: string
  type: QuestionType
  prompt: string
  choices: { id: string; text: string }[]
  correctChoiceId: string
  explanation: string
}
```

計測系：

```ts
export interface TrainingSession {
  id: string
  userId: string
  startedAt: Date
  completedAt: Date | null
  durationSeconds: number | null
  sessionType: 'baseline' | 'daily' | 'single' | 'recall'
}

export interface TrainingResult {
  id: string
  userId: string
  sessionId: string
  trainingType: TrainingType
  passageId: string | null
  cpm: number | null
  comprehensionScore: number | null      // 0–100（文章の理解度に限る）
  immediateRecallScore: number | null    // 0–100
  delayedRecallScore: number | null      // 0–100
  /**
   * トレーニング固有の正答率・一致率（0–100）。
   * Meaning Flash の意味把握、Prediction の予測妥当性、Variable Speed の一致率。
   * comprehensionScore と分けている理由：同じ列に入れると Skill Profile の
   * 測定源が混ざり、どの能力を測った値か区別できなくなるため。
   */
  accuracyScore: number | null
  exposureMs: number | null              // Meaning Flash の表示時間
  level: ChunkLevel | null               // Chunk Reading / Meaning Flash のレベル
  difficulty: Difficulty | null
  /** 行動ログ：Regression Control の評価に使う */
  backCount: number | null
  pauseCount: number | null
  targetCpm: number | null               // その回に指示した速度
  valid: boolean                         // 計測として有効か（§ARCHITECTURE 6）
  createdAt: Date
}
```

### Skill Profile（保存しない導出値）

```ts
export type SkillId =
  | 'reading_speed' | 'chunk_recognition' | 'meaning_extraction'
  | 'structure_recognition' | 'prediction' | 'adaptive_reading'
  | 'comprehension' | 'immediate_recall' | 'delayed_recall'

export type SkillState = 'unmeasured' | 'weak' | 'normal' | 'strong'

export interface SkillMeasurement {
  id: SkillId
  score: number | null      // 未測定は null（0 で埋めない）
  state: SkillState
  sampleCount: number
  trend: number | null      // 後半平均 − 前半平均
}
```

Skill Profile は `training_results` と `recall_tasks` から**毎回算出する**。
テーブルには持たない。判定基準を変えたときに過去の記録と食い違わないようにするため。

### Baseline Profile（profiles に保存）

```ts
export interface BaselineProfile {
  cpm: number | null              // 有効な測定の中央値
  comprehension: number | null
  mainIdea: number | null         // 設問タイプ別の内訳
  causeEffect: number | null
  structure: number | null
  immediateRecall: number | null
  attempts: number
  updatedAt: string | null
}
```

## 2. テーブル一覧（将来の同期用・現時点では未実装）

> §2・§3・§5 は、将来クラウド同期を足すときのための設計。
> **現在の保存先は端末内の IndexedDB のみで、Supabase も Auth も実装していない（§6）。**
> 同期を足す場合も、クラウドが無い状態で全機能が動くことを壊さない。

| テーブル | 種別 | 概要 |
|---|---|---|
| `profiles` | user | ユーザー設定・基準値 |
| `training_passages` | content | 教材本文 |
| `training_questions` | content | 理解度設問 |
| `training_sessions` | user | 1回のトレーニング実施単位 |
| `training_results` | user | セッション内の各トレーニング結果 |
| `reading_tests` | user | Baseline / 読書速度測定の生ログ |
| `recall_tasks` | user | 翌日 Recall のスケジュールと結果 |
| `daily_training_plans` | user | 当日の生成済みトレーニング構成 |

content 系は全ユーザー共通の読み取り専用。user 系は RLS で本人のみ。

## 3. スキーマ（PostgreSQL）

```sql
-- ============ profiles ============
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  baseline_cpm      integer check (baseline_cpm between 100 and 5000),
  target_cpm        integer check (target_cpm  between 100 and 5000),
  -- 理解の内訳と想起まで含めた現在地（CPM は有効な測定の中央値）
  baseline_profile  jsonb,
  -- Baseline で使用済みの教材。再測定で同じ文章を出さないために持つ
  used_baseline_passage_ids text[] not null default '{}',
  preferred_duration_minutes smallint not null default 30
                       check (preferred_duration_minutes in (10, 20, 30)),
  chunk_level       smallint not null default 2 check (chunk_level between 1 and 5),
  meaning_flash_level smallint not null default 2
                       check (meaning_flash_level between 1 and 5),
  timezone          text    not null default 'Asia/Tokyo',
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============ content ============
create table public.training_passages (
  id               text primary key,                   -- 'biz-001' 等、seed と一致させる
  title            text not null,
  category         text not null check (category in
                     ('business','technology','economics','psychology','science','history','general')),
  difficulty       smallint not null check (difficulty between 1 and 5),
  source           text not null default 'seed' check (source in ('seed','imported','generated')),
  content          text not null,
  character_count  integer not null check (character_count > 0),
  estimated_difficulty jsonb not null,   -- DifficultyFactors
  key_points       jsonb not null,       -- string[]
  paragraphs       jsonb not null,       -- PassageParagraph[]
  chunks           jsonb not null,       -- string[]
  owner_id         uuid references auth.users(id) on delete cascade,  -- 将来の取り込み用。seed は null
  created_at       timestamptz not null default now()
);
create index on public.training_passages (category, difficulty);

create table public.training_questions (
  id               text primary key,
  passage_id       text not null references public.training_passages(id) on delete cascade,
  type             text not null check (type in
                     ('main_idea','detail','cause_effect','inference','structure')),
  prompt           text not null,
  choices          jsonb not null,       -- {id,text}[]
  correct_choice_id text not null,
  explanation      text not null,
  position         smallint not null
);
create index on public.training_questions (passage_id, position);

-- ============ sessions / results ============
create table public.training_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  session_type     text not null check (session_type in ('baseline','daily','single','recall')),
  local_date       date not null            -- ユーザーTZでの実施日。streak と plan の突合に使う
);
create index on public.training_sessions (user_id, local_date desc);

create table public.training_results (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  session_id             uuid not null references public.training_sessions(id) on delete cascade,
  training_type          text not null,
  passage_id             text references public.training_passages(id) on delete set null,
  cpm                    numeric(8,2) check (cpm >= 0),
  comprehension_score    smallint check (comprehension_score      between 0 and 100),
  immediate_recall_score smallint check (immediate_recall_score   between 0 and 100),
  delayed_recall_score   smallint check (delayed_recall_score     between 0 and 100),
  -- トレーニング固有の正答率・一致率（Meaning Flash / Prediction / Variable Speed）
  accuracy_score         smallint check (accuracy_score           between 0 and 100),
  exposure_ms            integer  check (exposure_ms >= 0),
  level                  smallint check (level between 1 and 5),
  target_cpm             numeric(8,2),
  back_count             integer default 0 check (back_count  >= 0),
  pause_count            integer default 0 check (pause_count >= 0),
  difficulty             smallint check (difficulty between 1 and 5),
  valid                  boolean not null default true,
  created_at             timestamptz not null default now()
);
create index on public.training_results (user_id, created_at desc);
create index on public.training_results (user_id, training_type, created_at desc);

-- ============ baseline / reading test ============
create table public.reading_tests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  session_id          uuid references public.training_sessions(id) on delete cascade,
  passage_id          text not null references public.training_passages(id),
  is_baseline         boolean not null default false,
  elapsed_seconds     numeric(8,2) not null check (elapsed_seconds > 0),
  character_count     integer not null check (character_count > 0),
  cpm                 numeric(8,2) not null,
  comprehension_score smallint check (comprehension_score between 0 and 100),
  recall_score        smallint check (recall_score        between 0 and 100),
  recall_text         text,
  -- 設問タイプ別の正答率。Baseline Profile の内訳を作る元になる
  type_scores         jsonb,
  created_at          timestamptz not null default now()
);
create index on public.reading_tests (user_id, created_at desc);

-- ============ recall ============
create table public.recall_tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  passage_id        text not null references public.training_passages(id) on delete cascade,
  source_session_id uuid references public.training_sessions(id) on delete set null,
  scheduled_date    date not null,                 -- ユーザーTZの「翌日」
  expires_on        date not null,                 -- scheduled_date + RECALL_WINDOW_DAYS
  completed_at      timestamptz,
  recall_score      smallint check (recall_score between 0 and 100),
  recall_text       text,
  status            text not null default 'pending'
                      check (status in ('pending','completed','expired')),
  created_at        timestamptz not null default now(),
  unique (user_id, passage_id, scheduled_date)
);
create index on public.recall_tasks (user_id, scheduled_date) where status = 'pending';

-- ============ plan ============
create table public.daily_training_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  plan_date         date not null,
  total_minutes     smallint not null check (total_minutes in (10,20,30)),
  blocks            jsonb not null,   -- PlanBlock[]（TRAINING_LOGIC.md §5）
  target_cpm        numeric(8,2),
  chunk_level       smallint check (chunk_level between 1 and 5),
  generated_reason  jsonb,            -- 弱点判定の根拠。AI Coach の説明に流用
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_id, plan_date)
);
```

## 4. DifficultyFactors

難易度は文字数だけで決めない。教材ごとに次の内訳を持たせ、`difficulty`（1–5）はこの加重和から算出する。

```ts
export interface DifficultyFactors {
  vocabulary: 1|2|3|4|5        // 語彙の平易さ
  sentenceLength: 1|2|3|4|5    // 一文の長さ
  abstraction: 1|2|3|4|5       // 抽象度
  informationDensity: 1|2|3|4|5// 情報密度
  logicalStructure: 1|2|3|4|5  // 論理構造の複雑さ
  domainSpecificity: 1|2|3|4|5 // 専門性
}
```

算出は `core/metrics/difficulty.ts`（重みは `training-config.ts`）。教材の `difficulty` は算出値と ±1 以内であることをテストで検証する。

## 5. RLS ポリシー

```sql
alter table public.profiles              enable row level security;
alter table public.training_sessions     enable row level security;
alter table public.training_results      enable row level security;
alter table public.reading_tests         enable row level security;
alter table public.recall_tasks          enable row level security;
alter table public.daily_training_plans  enable row level security;
alter table public.training_passages     enable row level security;
alter table public.training_questions    enable row level security;

-- user 系：本人のみ（select/insert/update/delete を同じ述語で）
create policy "own rows" on public.training_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- 他の user 系テーブルにも同型のポリシーを作成。profiles は user_id ではなく id で判定。

-- content 系：seed は全員読める。将来の取り込み教材は所有者のみ。書き込みは service_role のみ
create policy "read seed or own" on public.training_passages
  for select using (owner_id is null or auth.uid() = owner_id);
create policy "read questions of readable passages" on public.training_questions
  for select using (exists (
    select 1 from public.training_passages p
    where p.id = passage_id and (p.owner_id is null or auth.uid() = p.owner_id)));
```

- `profiles` は `auth.users` への insert トリガー（`handle_new_user()`）で自動生成する。
- `updated_at` は `moddatetime` トリガーで更新する。
- seed 投入は service_role キーを使う `supabase/seed.sql`（`scripts/generate-seed-sql.ts` が生成）。

## 6. ローカル保存（Phase 2 — Local First）

記録は端末内にだけ保存される。アカウントもサーバーも要らない。

### 6-1. IndexedDB（既定の保存先）

データベース名 `speed-reading-lab` / **version 1**。object store は collection と 1 対 1、
`keyPath` は `id`。索引は作らず、全件取得して呼び出し側で絞る（個人の学習記録の規模で足りる）。

| object store | 内容 | 件数の目安 |
|---|---|---|
| `profile` | Profile（1 件のみ。id は `local-user`） | 1 |
| `sessions` | TrainingSession | 1 日 1〜数件 |
| `results` | TrainingResult | 1 セッションあたり 5〜10 件 |
| `readingTests` | ReadingTest（Baseline） | 数件 |
| `recallTasks` | RecallTask | 1 日 0〜数件 |
| `plans` | DailyTrainingPlan（1 日 1 件） | 1 日 1 件 |

読み出しは `TrainingRepository` が zod で検証し、スキーマに合わない行は捨てる。
**返す順序は `createdAt` 昇順**に揃える（IndexedDB は id 順で返すため。
trend 判定・直近 N 件・最新 Baseline が並び順に意味を持たせている）。

#### スキーマの version と migration

| version | 内容 |
|---|---|
| 1 | collection ごとの object store を作る（`keyPath: id`） |

- スキーマ変更は `SCHEMA_MIGRATIONS` への**追記のみ**で行い、
  端末に保存されている version から順に適用する。
- **DB を削除して作り直す方式は通常経路では使わない。**
  既存の Training History / Baseline / Recall / Settings はそのまま引き継ぐ。
- migration が失敗した場合は versionchange トランザクションを中断し、
  DB を旧 version のまま残す（記録を壊さない）。
- 手順と設計の詳細は [PERSISTENCE.md](PERSISTENCE.md) §3。

### 6-2. localStorage（Phase 1 の形式・現在は代替保存先）

キーは `srl:v1:<entity>`。IndexedDB が使えない環境ではこの形式のまま動く。

```
srl:v1:profile        Profile        （単体オブジェクト）
srl:v1:sessions       TrainingSession[]
srl:v1:results        TrainingResult[]
srl:v1:reading_tests  ReadingTest[]
srl:v1:recall_tasks   RecallTask[]
srl:v1:plans          DailyTrainingPlan[]
```

### 6-3. 移送（Phase 1 → Phase 2）

起動時に一度だけ、`srl:v1:*` の中身を IndexedDB へ移す。

- **移動であって複製ではない。** 取り込み後に旧キーを削除し、正となる保存先を 1 つに保つ。
- id 単位の upsert。途中で中断されても、次の起動で残りをやり直せる。
- 壊れた JSON・`id` を持たない行は落とす。移送の失敗で起動できなくなることはない。

### 6-4. 後方互換の扱い

フィールドを追加するときはキーを上げず、**読み出し時に既定値を与える**。
端末に残っている記録を捨てないためであり、実際に次の移送を行っている。

| 旧 | 新 | 扱い |
|---|---|---|
| `results[].chunkLevel` | `results[].level` | 読み出し時に移送する |
| （なし） | `results[].accuracyScore` / `exposureMs` | 既定値 `null` |
| （なし） | `profile.baselineProfile` | 既定値 `null`（`baselineCpm` のみで動作する） |
| （なし） | `profile.usedBaselinePassageIds` | 既定値 `[]` |
| （なし） | `profile.meaningFlashLevel` | 既定値 2 |
| （なし） | `reading_tests[].typeScores` | 既定値 `null` |

スキーマに合わない行は破棄して初期化する（過去の壊れたデータでアプリが起動しなくなるのを避ける）。

## 7. Backup ファイル形式

Settings から書き出せる JSON。端末外へ記録を持ち出す唯一の経路。

### 現行（schemaVersion 2）

```jsonc
{
  "format": "speed-reading-lab.backup",
  "schemaVersion": 2,
  "exportedAt": "2026-08-20T09:00:00.000Z",
  "appVersion": "0.1.0",
  "data": {
    "profile": [ /* Profile */ ],
    "sessions": [ /* TrainingSession[] */ ],
    "results": [ /* TrainingResult[] */ ],
    "readingTests": [ /* ReadingTest[] */ ],
    "recallTasks": [ /* RecallTask[] */ ],
    "plans": [ /* DailyTrainingPlan[] */ ]
  }
}
```

### version の履歴

| schemaVersion | 形 | 取り込み |
|---|---|---|
| 1 | `{ format, version, exportedAt, collections }` | `BACKUP_MIGRATIONS` で 2 へ変換して取り込む |
| 2 | 上記（`schemaVersion` / `data` / `appVersion`） | 現行 |

### 取り込みの流れ

```
ファイル → version 判定 → migration → 封筒の zod 検証 → 行ごとの zod 検証 → 保存
```

- ファイル名は `speed-reading-lab-backup-YYYY-MM-DD.json`。
- 復元は**置き換え**。全行の検証を通してから置き換えるため、「半分だけ復元」にはならない。
  通らなかった行は件数だけ報告して除外する。
- 拒否の理由は 3 つに分ける。
  `format`（当アプリのファイルでない）/ `version`（現行より新しい）/ `corrupt`（中身が読めない）。
- **拒否したときは既存データに触らない。** 特に `collections` が欠けた v1 ファイルを
  「空のバックアップ」とみなして全消去する事故を起こさないよう、欠損は既定値で埋めない。
- 保存先の構造（object store 等）ではなく collection 単位の素の JSON なので、
  将来保存先が変わっても読み込める。
- 旧 version のファイルを読めることは永続的な責務。詳細は [PERSISTENCE.md](PERSISTENCE.md) §5。
