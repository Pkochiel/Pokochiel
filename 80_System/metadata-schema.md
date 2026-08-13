# Metadata Schema

すべてのノートは YAML frontmatter を持つ。
**ここに定義されていないキーを追加しない。** 必要なら本ファイルを先に更新する。

## 必須キー（全 type 共通）

| キー | 型 | 値 | 備考 |
| --- | --- | --- | --- |
| `title` | string | ファイル名と一致 | WikiLink 表記と同一にする |
| `type` | enum | 下表参照 | フォルダと1対1で対応 |
| `status` | enum | `raw` / `processed` / `knowledge` / `connected` / `reusable` | `knowledge-lifecycle.md` 参照 |
| `created` | date | `YYYY-MM-DD` | **不変。書き換え禁止** |
| `updated` | date | `YYYY-MM-DD` | 内容変更のたびに更新 |
| `tags` | list | 統制語彙のみ | 3〜5個。`tag-taxonomy.md` 参照 |
| `source` | string | URL / 出典 / `自身の考察` | 空文字可。ただし**あるものを消さない** |
| `ai_generated` | enum | `true` / `false` / `partial` | 下記参照 |

### `type` とフォルダの対応

| `type` | フォルダ | テンプレート |
| --- | --- | --- |
| `atomic` | `20_Knowledge/` | `atomic-note.md` |
| `source` | `40_Sources/**` | `source-note.md` / `youtube-summary.md` |
| `meeting` | `40_Sources/meetings/` | `meeting-note.md` |
| `project` | `10_Projects/<project>/` | `project-note.md` |
| `decision` | `60_Decisions/` | `decision-record.md` |
| `framework` | `30_Frameworks/` | `framework.md` |
| `moc` | `50_MOCs/` | `moc.md` |
| `daily` | `05_Daily/` | `daily-note.md` |
| `inbox` | `00_Inbox/` | `inbox-capture.md` |

### `ai_generated` の判定基準

| 値 | 意味 | Claude の扱い |
| --- | --- | --- |
| `false` | 人間が書いた | **本文を書き換えない。** 追記は `## AI Notes` を新設して行う |
| `partial` | 人間の素材を AI が整形・要約した | AI 生成部分のみ更新可。原文セクションは不可 |
| `true` | AI が生成した | 更新可 |

人間が AI 生成ノートを編集したら、`partial` に落とすのが望ましい。

---

## 任意キー

| キー | 対象 type | 型 | 用途 |
| --- | --- | --- | --- |
| `confidence` | atomic, decision | `high`/`medium`/`low` | 根拠の強さ。`low` は要検証 |
| `project` | meeting, decision, source | string | 関連プロジェクト名 |
| `author` | source | string | 原著者・チャンネル名 |
| `published` | source | date | 原典の公開日（取得日ではない） |
| `decided_on` | decision | date | 意思決定日 |
| `review_after` | atomic, framework | date | 陳腐化しやすい知識の再確認目安 |
| `aliases` | 全 type | list | Obsidian 標準。表記ゆれの吸収に使う |

### `aliases` の使いどころ

同じ概念に複数の呼び方があるとき、**新規ノートを作らず** `aliases` で吸収する。

```yaml
title: 大規模言語モデル
aliases: [LLM, Large Language Model]
```

これにより `[[LLM]]` と書いても同じノートに解決される。
表記ゆれによる重複ノートの最大の防止策である。

---

## 検証ルール

Claude はノートを作成・更新するとき、以下を自己チェックすること。

- [ ] 必須キーが8つすべて存在する
- [ ] `type` とフォルダが対応表と一致している
- [ ] `title` = ファイル名（拡張子除く）
- [ ] `created` を書き換えていない
- [ ] `updated` を今日の日付にした
- [ ] `tags` が taxonomy 内、かつ5個以下
- [ ] `source` を消していない
- [ ] `ai_generated` が実態と一致している
- [ ] 秘密情報（キー・トークン・認証情報）が含まれていない
