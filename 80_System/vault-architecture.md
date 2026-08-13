# Vault Architecture

## 設計判断

### 判断1: フォルダは「種類」だけを表す

内容領域（AI / 自動車 / 公共 / 戦略 …）でフォルダを分けない。
理由: 1つのノートが複数領域にまたがるとき、フォルダは1つしか選べないため、
必ず破綻する。領域の表現は **Tag と MOC** が担当する。

フォルダが答えるのは「これは**どういう形式のノート**か」だけ。

### 判断2: 階層は原則2層まで

`10_Projects/<project>/` と `40_Sources/<media>/` のみ1段のサブフォルダを許可。
深い階層は、人間の記憶にもツールの検索にも負荷をかけ、移動コストを上げる。

### 判断3: `05_Daily` を追加した（ユーザー提案からの変更点）

当初案では Daily Notes の置き場所が未定だった。
`00_Inbox` に混ぜると「未処理のもの」と「毎日の記録」が混在し、
Inbox を空にする運用（Inbox Zero）が成立しなくなる。
日次ノートは Inbox の**手前**にある入力源なので、番号も `00` と `10` の間に置いた。

### 判断4: `30_Frameworks` と `60_Decisions` を独立させた

どちらも実質は Atomic Note に近いが、
- Frameworks = **再利用が主目的**の資産。検索頻度が突出して高い
- Decisions = **時系列で不変**の記録。更新せず積み上げる性質

という運用の違いがあるため、`20_Knowledge` から分離する価値がある。

---

## フォルダ責務

### `00_Inbox/`
すべての入口。未処理の投げ込み。
- `status: raw` のみが存在する
- **滞留させない。** ここが溜まると Knowledge OS は機能しない
- `/process-inbox` の処理対象
- ここには何を入れてもよい（形式自由）

### `05_Daily/`
日次ノート。`YYYY-MM-DD.md`。
- その日の記録・断片的な思考の受け皿
- `## Insights` に書かれたものが Atomic Note の主要な種になる

### `10_Projects/`
案件・プロジェクト単位。`<project-name>/README.md` を中心に据える。
- クライアント名は匿名化を推奨（`A社DX` など）
- プロジェクト終了後、**汎用化できる知識を `20_Knowledge` に切り出す**
- 切り出しが終わったプロジェクトは `90_Archive/` へ（人間の承認後）

### `20_Knowledge/`
**Knowledge OS の中核。** Atomic Note の本体。
- 1ノート1概念
- フラット（サブフォルダを作らない）。構造は WikiLink と MOC が持つ
- ここのノートは、どのプロジェクトからも参照できる汎用資産である

### `30_Frameworks/`
コンサルティングフレームワーク。再利用可能な思考の型。
- 「使いどころ」と「使ってはいけない場面」の両方を書く
- フラット

### `40_Sources/`
出典ノート。原文の保管場所。
```
40_Sources/youtube/     YouTube 要約
40_Sources/web/         Web 記事・AI ニュース
40_Sources/documents/   PDF・書籍・社内資料
40_Sources/meetings/    会議録
```
- **原文と AI 生成物を必ず分離する**
- Source Note は Atomic Note の「引用元」であり、常に双方向リンクで結ぶ

### `50_MOCs/`
Map of Content。領域ごとの Knowledge Map。
- `MOC - <領域>.md` 命名
- リンク集にしない（`CLAUDE.md` §7.3）
- 予定領域: AI / Consulting / Strategy / Automotive / Public Sector /
  Technology / Productivity
- **MOC は必要になってから作る。** 空の MOC を先に量産しない

### `60_Decisions/`
意思決定記録。個人・プロジェクト双方。
- 一度書いたら基本的に更新しない（追記のみ）
- 「前提が崩れたら見直す」トリガーを必ず書く

### `70_Templates/`
Obsidian テンプレート。出力形式の単一の源。

### `80_System/`
本ディレクトリ。Knowledge OS 自体の仕様。

### `90_Archive/`
陳腐化・終了したもの。**削除の代わりの置き場所。**
- 移動には人間の承認が必須
- 中の構造は元フォルダを踏襲する

---

## ノートの流れ

```
05_Daily ─┐
          ├─→ 00_Inbox ─→ 40_Sources ─→ 20_Knowledge ─→ 50_MOCs に登録
外部情報 ─┘        │                        ↑
                   └────────────────────────┘
                     （Source 不要な直接の気づき）

10_Projects ─→（汎用化）─→ 20_Knowledge / 30_Frameworks
            └─→ 60_Decisions
```

---

## 今後の拡張候補（未実装）

- `.obsidian/` の設定共有（プラグイン構成の固定）
- `80_System/scripts/` — Vault の静的チェック（frontmatter 検証・孤立ノート検出）
- リポジトリルートに残っている旧スクリプト（`scrape_*.py`,
  `3min_networking.txt`）の `90_Archive/legacy/` への移動 —
  **ユーザーの承認待ち。無断で動かさない**
