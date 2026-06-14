# CLAUDE.md — Claude Code 作業ガイド

このファイルはClaude Codeが最初に読む作業ルールです。作業前に必ず `bible.md` と `HANDOFF.md` も読んでください。

## プロジェクト概要

ブラウザで動く恋愛シミュレーション×ノベルゲーム『恋愛☆大作戦！ 〜となりの席は天敵だった件〜』。
スクールランブル風のコメディ基調で、各ルート終盤に感動を効かせる（アマガミ的）。
個人開発・スモールスタート。**単一HTMLファイル（index.html）で完結**。ビルド不要。

## 最重要ルール

1. **設定の正典は `bible.md`**。キャラ・世界観・システムを変更/追加するときは必ずbibleと整合させ、変えたらbibleも更新する。
2. **絵は画像差し込み式**。`assets/` に所定名のPNGを置くと自動反映。無ければSVG/CSSの仮絵にフォールバック。コードを変えずに絵を差し替えられる構造を壊さないこと。
3. **シーンのインデックス管理に注意**。`scripts` 配列に要素を挿入すると、`next` / `gotoAfter` / `CHAPTER_START` の数値参照がズレる。挿入したら必ず全参照を再計算し、範囲外参照が無いか検証する（下記「検証コマンド」）。
4. 既存の画風・トーン（明るいポップUI、ネオポップ風の太枠＋ドロップシャドウ）を維持する。

## ファイル構成

```
love_sim/
├── index.html      ← ゲーム本体（HTML/CSS/JS全部入り）。これを編集する
├── bible.md        ← 設定の正典。必ず参照・更新
├── CLAUDE.md       ← このファイル
├── HANDOFF.md      ← 現状と次やることリスト
├── README.md       ← 起動方法など
├── art/
│   └── prompts.md  ← 画像生成AI用プロンプト集（Gemini向け記述あり）
└── assets/
    ├── chara/      ← 立ち絵PNG（例: ayaka_normal.png）透過必須
    ├── bg/         ← 背景PNG（例: classroom.png）
    └── cg/         ← イベントCG PNG（例: cg_ayaka_fastball.png）※1枚実装済
```

## コードの構造（index.html内 <script>）

- `DEFAULT_STATE` … ゲーム状態の初期値。`affection`は**キャラ別**、`params`は育成値、`flags`は分岐管理
- `CHARS` … 登場キャラ定義（現在 ayaka / kenji / rio）。各キャラに表情差分を返す `svgFn`
- `charAyaka/charKenji/charRio` … SVG仮立ち絵を返す関数（画像が無いとき使われる）
- `scripts` … シナリオ本体（配列）。型は `bible.md` 4-3参照
- `runScript(i)` … 1シーン描画。bg/cg/manga/char/textを処理
- `ART` + `tryImage()` … 画像優先・SVGフォールバックの心臓部
- `updateChars` `changeBg` `showCG` … それぞれ立ち絵・背景・CGの画像差し込み
- `selectChoice` `applyEffect` … 選択肢と好感度/パラメータ変動
- `buildCalendar` `doAction` … カレンダー育成パート
- `autoSave` `loadGame` … localStorageセーブ（キー: `koi_daisakusen_save_v1`）

## シナリオの書き方（型）

```js
{ type:'narration', bg:'classroom', text:'…' }                          // 地の文
{ type:'dialogue', speaker:'ayaka', expr:'smile', text:'…' }            // セリフ
{ type:'dialogue', speaker:'ayaka', expr:'shy', cg:'cg_prologue', text:'…' } // CG付き
{ type:'choice', choices:[
    { text:'選択肢', effect:{ ayaka:+12, friend:+5 }, flag:'xxx', next:7 },
]}
{ ..., gotoAfter:19 }   // 次シーンを明示指定（分岐合流など）
{ ..., isEnd:true, chapter:1 }  // 話の終端
```
- `speaker`/`char2` は CHARS のキー
- `expr` … ayaka: normal/smile/shy/angry/surprised, kenji: normal/laugh/shocked, rio: normal/smile/serious/shy
- `effect` のキー … 好感度(ayaka/rio) または 育成値(culture/sport/friend)

## 検証コマンド（編集後は必ず実行）

```bash
# JS構文・シーン参照の整合チェック
python3 - << 'EOF'
import re
html=open('index.html').read()
js=re.search(r'<script>(.*)</script>',html,re.S).group(1)
bal=0
for c in js:
    if c=='{':bal+=1
    elif c=='}':bal-=1
print('brace balance(0が正常):',bal)
body=re.search(r'const scripts = \[(.*?)\n\];',html,re.S).group(1)
n=len([l for l in body.split(chr(10)) if l.strip().startswith("{ type:")])
refs=[int(r) for r in re.findall(r'(?:next|gotoAfter):(\d+)',body)]
print('シーン数:',n,'/ 範囲外参照:',[r for r in refs if r>=n] or 'なし')
EOF
```

## 動作確認

```bash
python3 -m http.server 8000
# http://localhost:8000 をブラウザで開く
```

## やってはいけないこと

- localStorage以外のブラウザ非対応APIを使わない
- ビルドツール・npm依存を増やさない（単一HTML維持）
- bibleと矛盾するキャラ改変を勝手にしない
- 既存の画像フォールバック構造を壊さない
