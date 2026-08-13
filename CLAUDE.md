# CLAUDE.md — Knowledge OS 憲法

このリポジトリは **Obsidian Vault 兼 個人用 Knowledge OS** である。
Claude Code は Vault を操作する **すべてのセッション・すべての操作**において、
本ファイルを前提条件として読み込み、ここに書かれたルールに従うこと。

本ファイルと矛盾する指示をユーザーから受けた場合は、
実行前に「CLAUDE.md の◯◯と矛盾します」と指摘し、確認を取ること。

---

## 1. Mission

ユーザー（コンサルタント）が日々触れる情報を、
**再利用可能な知識資産**に変換し続けること。

```
Internet / YouTube / Documents / Manual Notes
        ↓
Raw Information            → 00_Inbox
        ↓
AI による整理・要約・分類
        ↓
既存 Knowledge との照合 / 重複排除
        ↓
Atomic Note 化 → WikiLink 生成 → MOC 更新
        ↓
Obsidian Vault             → 人間が閲覧・編集・思考
```

Claude Code の担当領域:
Vault 全体検索 / 新規ノート生成 / 重複チェック / ノート整理 / Atomic Note 化 /
タグ付与 / WikiLink 生成 / MOC 更新 / Inbox 整理 / 定期 Knowledge Refinery

**最終的な判断者は常に人間である。** Claude は提案し、人間が承認する。

---

## 2. Knowledge Philosophy

### 2.1 分類は単一手段に依存しない

| 手段 | 役割 |
| --- | --- |
| **Folder** | ノートの「種類」を1つだけ決める（内容ではなく形式で分ける） |
| **Tag** | 領域・テーマによる横断（統制語彙のみ。乱立厳禁） |
| **WikiLink** | 概念どうしの意味的関係。Knowledge OS の主要な構造 |
| **MOC** | 領域ごとの地図。入口であり思考の足場 |
| **Metadata** | 機械処理・フィルタ・ライフサイクル管理 |

**フォルダ階層で知識を分類しようとしないこと。** 知識の構造は WikiLink と MOC が担う。
フォルダは原則2階層まで（例外: `10_Projects/<project>/`）。

### 2.2 Atomic Note 原則

> 1ノート = 1つの主要概念・知識・主張・インサイト

- タイトルだけで中身が言い切れないなら、それは分割すべきノートである
- 他の文脈から引用・再利用できる粒度にする
- **ただしすべてを Atomic 化しなくてよい。** 以下は非 Atomic のまま管理する:
  Meeting Notes / Project Notes / Source Notes / Daily Notes / YouTube Summaries

### 2.3 Knowledge Lifecycle

```
Raw → Processed → Knowledge → Connected → Reusable
```

| status | 意味 | 主な置き場所 |
| --- | --- | --- |
| `raw` | 未処理の投げ込み。原文のまま | `00_Inbox`, `05_Daily` |
| `processed` | 要約・分類済み。まだ知識化されていない | `40_Sources` |
| `knowledge` | Atomic Note として成立している | `20_Knowledge`, `30_Frameworks` |
| `connected` | 関連ノートと WikiLink で接続され、MOC に登録済み | `20_Knowledge` |
| `reusable` | 実務でそのまま使える完成度。検証済み | `20_Knowledge`, `30_Frameworks` |

**最重視するのは `raw → processed → knowledge` の遷移（Inbox の知識化）である。**

---

## 3. Folder Structure

```
00_Inbox/        未処理の投げ込み。すべての入口。滞留させない
05_Daily/        日次ノート。YYYY-MM-DD.md
10_Projects/     案件・プロジェクト単位。<project-name>/ で1階層のみ許可
20_Knowledge/    Atomic Note の本体。Knowledge OS の中核
30_Frameworks/   コンサルティングフレームワーク（再利用可能な思考の型）
40_Sources/      出典ノート。youtube/ web/ documents/ meetings/
50_MOCs/         Map of Content。領域ごとの Knowledge Map
60_Decisions/    意思決定記録（Decision Record）
70_Templates/    Obsidian テンプレート。ここを編集すると全体の出力形式が変わる
80_System/       Knowledge OS 自体の仕様書・ワークフロー定義
90_Archive/      廃止・陳腐化したもの。削除の代わりにここへ（人間の承認必須）
```

各フォルダの詳細は `80_System/vault-architecture.md` を参照。

**フォルダ選定は「ノートの種類（type）」だけで決める。** 内容領域（AI, 自動車, 公共 …）
でフォルダを分けてはならない。それは Tag と MOC の仕事である。

---

## 4. Metadata Rules

すべてのノートは YAML frontmatter を持つ。**キーを勝手に増やさないこと。**

```yaml
---
title: ノートのタイトル（ファイル名と一致させる）
type: atomic          # atomic|source|project|meeting|decision|framework|moc|daily|inbox
status: knowledge     # raw|processed|knowledge|connected|reusable
created: 2026-08-13   # YYYY-MM-DD。作成後は絶対に書き換えない
updated: 2026-08-13   # 内容を変更したら必ず更新する
tags: [ai, llm]       # 統制語彙のみ。3〜5個まで
source: "https://…"   # 出典。無ければ空でよいが、あるなら必ず残す
ai_generated: partial # true|false|partial（AI関与度）
---
```

任意キー（必要な type のみ）:

| キー | 対象 type | 用途 |
| --- | --- | --- |
| `confidence` | atomic, decision | `high` / `medium` / `low`。根拠の強さ |
| `project` | meeting, decision, source | 関連プロジェクト名 |
| `author` | source | 原著者・チャンネル名 |
| `published` | source | 原典の公開日 |
| `decided_on` | decision | 意思決定日 |
| `review_after` | atomic, framework | 陳腐化しやすい知識の再確認目安日 |

### ルール

- `source` は**絶対に失わせない**。加工の過程で落ちたら、それは不具合である
- `created` は不変。`updated` は変更のたびに更新
- `ai_generated` の判定:
  - `false` = 人間が書いた。**Claude はここを書き換えてはならない**
  - `partial` = 人間の原文を AI が整形・要約した
  - `true` = AI が生成した
- 詳細スキーマ: `80_System/metadata-schema.md`

---

## 5. Naming Convention

| type | 命名 | 例 |
| --- | --- | --- |
| atomic | 概念そのものを表す名詞句。日付を付けない | `RAG は検索品質が上限を決める.md` |
| framework | フレームワーク名 | `MECE.md`, `3C分析.md` |
| source | `YYYY-MM-DD - 媒体 - タイトル` | `2026-08-13 - YouTube - Agent設計の勘所.md` |
| meeting | `YYYY-MM-DD - 会議名` | `2026-08-13 - A社 定例.md` |
| decision | `YYYY-MM-DD - 決定事項` | `2026-08-13 - Vault構造をtype基準に統一.md` |
| daily | `YYYY-MM-DD` | `2026-08-13.md` |
| moc | `MOC - 領域名` | `MOC - AI.md` |
| project | `<project>/README.md` + 配下ノート | `10_Projects/A社DX/README.md` |
| inbox | 自由。ただし内容が推測できる語を含める | `メモ - Agent評価の論点.md` |

### 共通ルール

- **ファイル名 = `title` = WikiLink 表記**。3つを常に一致させる
- 日本語・英語の混在は可。ただし**同じ概念に2つの表記を作らない**
  （既存ノートに `LLM` があるなら `大規模言語モデル` を新設しない → エイリアスで解決）
- 使用禁止文字: `/ \ : # ^ [ ] |`
- 連番プレフィックス（`01_`, `02_`）をノートに付けない。順序は MOC で表現する

---

## 6. Linking Rules

- **新規ノートは WikiLink を最低1本持つこと。** 孤立ノートを作らない
- リンクは `[[ノート名]]`。表示を変えたい場合のみ `[[ノート名|表示名]]`
- **存在しないノートへのリンクは原則作らない。** ただし「作るべきノート」を
  意図的に示す場合に限り可。その際は必ず作業サマリで未作成リンクを列挙する
- Atomic Note の `## Related` には、**なぜ関連するのか**を1行添える
  ```markdown
  - [[プロンプトキャッシュ]] — 同じコスト削減という文脈で対になる論点
  ```
- Source Note → Atomic Note、Atomic Note → Source Note の**双方向リンクを必ず張る**
- MOC への登録は「リンクを足す」だけで終わらせない（§7.3 参照）

---

## 7. Note Type Specifications

### 7.1 Atomic Note（`20_Knowledge/`）

必須セクション:

```markdown
## Summary        1〜3文。ここだけ読めば要点が分かる
## Key Insight    最も価値のある一撃。1〜2文。ここが弱いノートは Atomic にする価値がない
## Details        根拠・背景・具体例
## Implications   だから何か。実務・提案・意思決定への含意
## Related        [[関連ノート]] — 関連理由
## Source         出典。原文引用は > 引用記法で明示
```

### 7.2 Source Note（`40_Sources/`）

原文と AI 生成物を**視覚的に分離**する。

```markdown
## Raw / Original     原文・書き起こし・引用（改変禁止）
## AI Summary         AI による要約（AI生成であることを明記）
## Atomic Note 候補   ここから切り出すべき概念のリスト
## Extracted Notes    実際に生成した [[Atomic Note]] へのリンク
```

### 7.3 MOC（`50_MOCs/`）

**MOC はリンク集ではない。Knowledge Map である。** 以下を必ず含む:

```markdown
## Overview            この領域を1段落で
## Core Concepts       中核概念とその1行説明
## Key Questions       この領域の主要論点
## Notes               関連ノート（サブテーマごとにグループ化）
## Open Questions      未解決の問い ← 最も価値が高いセクション
## Recent Insights     最近得た気づき
```

---

## 8. Tag Rules

**Tag 乱立が Knowledge OS を殺す最大の要因である。**

- 統制語彙は `80_System/tag-taxonomy.md` にのみ定義される
- **taxonomy に無いタグを Claude が独断で新設してはならない。**
  必要なら「このタグを追加すべき」と提案し、人間の承認を得てから taxonomy に追記する
- 1ノートあたり **3〜5個まで**
- Tag は「領域・テーマ」のみを表す。`type` / `status` は frontmatter の役割であり、
  タグで二重管理しない
- 階層タグは1階層まで（`ai/llm` は可、`ai/llm/rag/eval` は不可）

---

## 9. Safety Rules（最優先。他のすべてに優先する）

1. **既存ファイルを削除しない。** 削除が妥当と考えた場合も、提案に留める
2. **`ai_generated: false` のノート本文を上書きしない。** 追記は `## AI Notes`
   セクションを新設して行い、人間の記述と混ぜない
3. **大量変更の前に、変更内容の一覧を提示して承認を得る。**
   目安: 5ファイルを超える作成/変更、またはファイル移動を伴う操作
4. **原文と AI 生成内容を必ず区別する。** 原文は引用記法または `## Raw` に隔離
5. **`source` を失わせない**
6. **新規ノート作成前に必ず Vault を検索する。**（Grep/Glob でタイトル・別名・
   関連語を確認）重複を見つけたら、新規作成せず既存ノートへの追記を提案する
7. **秘密情報を Vault に書かない。** API キー・トークン・認証情報・
   顧客の機微情報を検出したら、書き込みを中断して警告する
8. **クライアント固有の機微情報**は、匿名化（`A社` 等）を提案する
9. ファイル移動は「移動先の提示 → 承認 → 実行」の順。無断で動かさない
10. Git commit は行ってよいが、**`push` の前に必ず変更内容を報告する**

---

## 10. Standard Workflow

Claude は Vault を操作するとき、常にこの順序で動く。

```
1. Read      CLAUDE.md（本ファイル）と関連する 80_System/ の仕様を確認
2. Search    Grep / Glob で既存ノートを検索（重複・関連ノートの発見）
3. Plan      何を作り、何を変えるかを列挙して提示
4. Confirm   5ファイル超・移動・削除を含むなら人間の承認を待つ
5. Execute   最小差分で実行
6. Link      WikiLink を張り、MOC を更新
7. Report    作成/変更ファイル・役割・未処理事項・次アクションを報告
```

**Search を飛ばして Execute に進むことを禁止する。** 重複ノートは
Knowledge OS の価値を最も直接的に毀損する。

---

## 11. Do / Don't

### Do

- 新規ノートを作る前に検索する
- 1ノート1概念を守る
- WikiLink を積極的に張る
- 出典を残す
- 変更を小さく保ち、Git の差分を読めるようにする
- 迷ったら `00_Inbox` に置き、人間の判断を仰ぐ
- 提案は具体的に（「整理しましょう」ではなく「この3ノートを統合しては」）

### Don't

- ファイルを勝手に削除・移動しない
- 人間が書いた文章を書き換えない
- タグを勝手に増やさない
- フォルダを勝手に増やさない・深くしない
- 1つのノートに複数の概念を詰め込まない
- 原文と AI 要約を混ぜない
- 存在しないノートへのリンクを無断で量産しない
- 「とりあえず全部 Atomic Note 化」をしない
- 秘密情報を Vault や Git に書かない

---

## 12. Quality Criteria

生成・整理したノートは、以下をすべて満たすこと。

**Atomic Note**

- [ ] タイトルだけで内容が推測できる
- [ ] 主要概念が1つに絞られている
- [ ] `## Key Insight` が具体的で、一般論になっていない
- [ ] `## Implications` に「だから何か」がある
- [ ] WikiLink が1本以上、関連理由付きである
- [ ] `source` がある（自分の思考なら `source: 自身の考察` と明記）
- [ ] frontmatter が完全である
- [ ] 3ヶ月後の自分が読んで意味が通る

**Source Note**

- [ ] 原文と AI 要約が分離されている
- [ ] 出典 URL・著者・日付がある
- [ ] Atomic Note 候補が抽出されている

**MOC**

- [ ] リンク集で終わっていない
- [ ] `## Open Questions` が埋まっている
- [ ] サブテーマごとにグループ化されている

**共通**

- [ ] Obsidian 互換 Markdown（独自記法を使わない）
- [ ] 孤立していない
- [ ] 既存ノートと重複していない

---

## 13. 設計原則

```
Simple first.
Automate later.
Structure before automation.
Human-readable before machine-optimized.
```

新機能・新構造を足したくなったら、まず「既存の Folder / Tag / WikiLink / MOC /
Metadata の組み合わせで表現できないか」を検討すること。
表現できるなら、足さない。

---

## 14. Commands

| コマンド | 状態 | 内容 |
| --- | --- | --- |
| `/process-inbox` | ✅ 実装済（最小版） | Inbox を分析し、分類・要約・Atomic 候補・重複を**提案**する（自動移動なし） |
| `/create-atomic-note` | 未実装 | Source Note から Atomic Note を生成 |
| `/update-moc` | 未実装 | 新規 Knowledge を関連 MOC に登録 |
| `/knowledge-refinery` | 未実装 | Vault 全体の重複・孤立・リンク不足・陳腐化を検出 |
| `/weekly-review` | 未実装 | 週次で新規 Knowledge・Insight・未解決 Questions をまとめる |
| `/youtube-digest` | 未実装 | YouTube 要約 → Atomic Note → MOC 更新まで |

定義は `.claude/commands/`、仕様は `80_System/workflows/` にある。
