# 80_System — Knowledge OS の仕様書

この Vault 自体の設計と運用ルールを置く場所。
**知識ではなくシステムの記述**が入る（知識は `20_Knowledge/`）。

## ドキュメント

| ファイル | 内容 |
| --- | --- |
| `vault-architecture.md` | フォルダ構造の設計と各フォルダの責務 |
| `metadata-schema.md` | frontmatter の全キー定義 |
| `naming-convention.md` | ファイル名・タイトル・WikiLink の規約 |
| `tag-taxonomy.md` | 統制タグ語彙（**ここに無いタグは使わない**） |
| `knowledge-lifecycle.md` | Raw → Reusable の遷移条件 |
| `workflows/process-inbox.md` | `/process-inbox` の仕様 |

## 上位ルール

すべての大原則は **リポジトリルートの `CLAUDE.md`** にある。
`80_System/` の各ドキュメントは、その詳細仕様である。

矛盾が生じた場合は `CLAUDE.md` が優先される。
矛盾を見つけたら、放置せずどちらかを直すこと。

## 実装状況

| 項目 | 状態 |
| --- | --- |
| フォルダ構造 | ✅ |
| CLAUDE.md | ✅ |
| Templates | ✅ |
| System docs | ✅ |
| `/process-inbox`（最小版・提案のみ） | ✅ |
| `/create-atomic-note` | ⬜ 未実装 |
| `/update-moc` | ⬜ 未実装 |
| `/knowledge-refinery` | ⬜ 未実装 |
| `/weekly-review` | ⬜ 未実装 |
| `/youtube-digest` | ⬜ 未実装 |
| 外部 API / 自動化（n8n, cron, Actions, MCP） | ⬜ 意図的に未着手 |

## 設計原則

```
Simple first. / Automate later. / Structure before automation.
Human-readable before machine-optimized.
```
