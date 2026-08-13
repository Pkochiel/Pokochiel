# 70_Templates

Obsidian の Templates プラグイン（コア）用テンプレート置き場。
Claude Code がノートを生成するときも、**必ずここのテンプレートを出力形式の基準にする。**

## 一覧

| ファイル | 対応 type | 置き場所 |
| --- | --- | --- |
| `atomic-note.md` | atomic | `20_Knowledge/` |
| `source-note.md` | source | `40_Sources/web/`, `40_Sources/documents/` |
| `youtube-summary.md` | source | `40_Sources/youtube/` |
| `meeting-note.md` | meeting | `40_Sources/meetings/` |
| `project-note.md` | project | `10_Projects/<project>/` |
| `decision-record.md` | decision | `60_Decisions/` |
| `framework.md` | framework | `30_Frameworks/` |
| `moc.md` | moc | `50_MOCs/` |
| `daily-note.md` | daily | `05_Daily/` |
| `inbox-capture.md` | inbox | `00_Inbox/` |

## 記法について

`{{title}}` `{{date:YYYY-MM-DD}}` は Obsidian コア Templates プラグインの記法。
Claude Code が生成する場合は、これらを**実際の値に置換してから**書き出すこと
（プレースホルダのまま残さない）。

`<!-- コメント -->` はセクションの書き方の指示。
ノートを埋めたら削除してよい（残っていても Obsidian の表示上は無害）。

## Obsidian 側の設定

Settings → Core plugins → Templates → Template folder location を
`70_Templates` に設定する。

## テンプレートを変更するとき

テンプレートの変更は Vault 全体の出力形式を変える。
frontmatter のキーを増減した場合は、`80_System/metadata-schema.md` と
`CLAUDE.md` §4 を必ず同時に更新すること。
