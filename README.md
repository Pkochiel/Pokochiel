# Speed Reading Lab

読む速度を上げるのではなく、**「速く理解し、必要な情報を選び、後から思い出せる能力」**を鍛える
日本語ファーストの速読トレーニング Web アプリ。

```
高速視認 → 意味認識 → 構造化 → 重要度判断 → 速度切替 → 理解 → 想起 → 長期記憶
```

## ステータス

**Phase 1（MVP）+ Phase 1.5（Training Core Enhancement）完了。**

Baseline Test → Daily Training → 翌日 Recall → Progress まで一連で完了でき、
9つの認知能力（Skill Profile）を独立に測定して、その日の構成を自動で決める。
データは端末内（localStorage）に保存される。永続化・認証・PWA・AI は未着手。

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

## 開発

```bash
npm install
npm run dev      # 開発サーバ
npm run check    # typecheck + lint + unit test
npm run e2e      # Playwright（build & start を含む）
```

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | コンセプト・非目標・指標・MVP スコープ・DoD |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技術スタック・レイヤリング・ディレクトリ構造・永続化の抽象化 |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | ドメイン型・PostgreSQL スキーマ・RLS・localStorage スキーマ |
| [docs/TRAINING_LOGIC.md](docs/TRAINING_LOGIC.md) | CPM / ERS / 速度適応 / プラン生成 / Recall スケジューリング / チャンク分割 |
| [docs/METRICS.md](docs/METRICS.md) | CPM / Comprehension / Recall / Skill Profile / ERS / 有効・無効判定の定義 |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Step 1–15 の実装順と各 Step の完了条件 |

## 技術スタック（予定）

Next.js 16 (App Router) / React 19 / TypeScript strict / Tailwind CSS v4 /
Supabase (PostgreSQL・Auth・RLS) / Vitest / Playwright / PWA

## 注意

リポジトリ直下の `3min_networking.txt` および `scrape_*.py` は本プロジェクトとは無関係な既存ファイルであり、変更しない。
