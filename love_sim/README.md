# 恋愛☆大作戦！ 〜となりの席は天敵だった件〜

ブラウザで動く恋愛シミュレーション×ノベルゲーム（スクールランブル風コメディ＋感動系）。
単一HTMLで完結。ビルド不要。

## クイックスタート

```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```
※ `index.html` 直接開きでも動くが、画像読み込みのため簡易サーバ推奨。

## ドキュメントを読む順番（重要）

1. **CLAUDE.md** … 作業ルール・コード構造・検証コマンド
2. **bible.md** … 世界観・キャラ・システムの設定（正典）
3. **HANDOFF.md** … 現状と次にやることリスト

## フォルダ構成

```
love_sim/
├── index.html      ← ゲーム本体（これを編集）
├── CLAUDE.md       ← Claude Code作業ガイド
├── bible.md        ← 設定の正典
├── HANDOFF.md      ← 引き継ぎ状況・TODO
├── README.md       ← このファイル
├── art/prompts.md  ← 画像生成AI用プロンプト集
└── assets/
    ├── chara/      ← 立ち絵PNG（透過必須）
    ├── bg/         ← 背景PNG
    └── cg/         ← イベントCG（cg_ayaka_fastball.png 実装済み）
```

## 絵の差し替え方

`art/prompts.md` のプロンプトで画像を生成 → 指定の名前で `assets/` に配置 → リロード。
画像が無い箇所はSVG/CSSの仮絵が自動表示されるので、用意できた分から差し替え可能。
