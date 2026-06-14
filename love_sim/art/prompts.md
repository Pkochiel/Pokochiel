# アート生成ガイド（画像生成AI用プロンプト集）

> このファイルは「絵を生成AIで作るときの指示書」です。
> アマガミ級の完成度を出す鍵は **画風の一貫性**。全部の絵を同じ画風・同じ設定で揃えること。
> 生成したPNGを `assets/` の所定フォルダに所定の名前で置けば、コードを触らずゲームに反映されます。

---

## 0. 最重要：画風を固定する「共通スタイル文」

すべての生成プロンプトの**先頭に必ずこれを貼る**。これがブレると絵が揃わず、安っぽくなります。

```
[共通スタイル]
high quality anime visual novel illustration, galge / dating-sim character art style,
clean lineart, soft cel shading, bright and warm color palette, detailed eyes with highlights,
2000s-2010s Japanese romance game aesthetic (like Amagami / Tokimeki Memorial),
masterpiece, best quality, highly detailed, official art
```

> 日本語生成AIなら：「高品質なアニメ調ギャルゲーのキャラクター立ち絵、明るく暖かい配色、
> 丁寧な線画、ソフトなセル塗り、ハイライトの入った大きな瞳、2000〜2010年代の恋愛ゲーム風、最高品質」

### 一貫性のコツ
- **シード固定**：同じキャラの表情差分を作るときは seed を固定し、表情の語句だけ変える
- **同じモデル/LoRA**を全キャラで使う
- **キャラ参照**：1枚決め絵ができたら、それを参照画像(i2i)にして差分を量産すると顔が安定する
- **解像度**：立ち絵は縦長（例 832×1216）、CGは横長（例 1216×832）

---

## 1. 立ち絵（assets/chara/）

### ⚠️ 立ち絵は「背景透過のキャラのみ画像」が必須
背景込みの一枚絵（球場や河川敷が描かれた絵）をそのまま立ち絵にすると、ゲーム背景の上に二重に背景が乗ってしまう。
背景込みの絵は **CG（assets/cg/）** として使い、立ち絵は人物だけを切り抜いた透過PNGを用意する。

**透過のやり方（どれか1つ）**
- `remove.bg` にドラッグ（無料・最速。ブラウザで完結）
- 画像生成時に `transparent background, simple background` を指定して背景を最初から無くす
- Photoshop / Clip Studio / GIMP で手動切り抜き

**置き場所**：透過できたら下表の名前で `assets/chara/` に保存 → リロードで自動反映。
無い場合は仮のSVG立ち絵が表示されるので、用意できた絵から順に差し替えればよい。

### 共通の構図指定（立ち絵プロンプトに追加）
```
full body OR upper body standing pose, facing viewer, simple flat background (will be removed),
transparent background, centered, looking at viewer
```
> 生成後、背景透過処理（remove.bg等）をして透過PNGにする。ファイル名は下表のとおり。

### 1-1. 神崎 彩花（野球少女・メインヒロイン）

> **参考画像あり**：オレンジ系の髪を高めのポニーテール、人懐っこい笑顔、白＆ネイビーの野球ユニフォーム、
> 夕暮れの球場。決め台詞「愛の剛速球、キャッチできる？」

#### 立ち絵5種 生成プロンプト（顔を揃えるための運用ルール込み）

**運用ルール（重要）**
- 下の【共通部分】は5枚すべて一字一句同じにする（顔のブレ防止）
- 【表情だけ】の1行を差し替える
- 1枚目で良い顔が出たら **seedを固定** して2〜5枚目に流用
- さらに1枚目を i2i 参照（強度0.5前後）にすると顔がより安定

**【共通部分】**
```
high quality anime visual novel illustration, galge / dating-sim character art style,
clean lineart, soft cel shading, bright and warm color palette, detailed eyes with highlights,
2000s-2010s Japanese romance game aesthetic, masterpiece, best quality, official art,
1girl, solo, cheerful high school baseball girl, orange-brown hair in a high ponytail,
warm brown eyes, white and navy baseball uniform, athletic build,
upper body to full body, facing viewer, looking at viewer,
simple plain white background, transparent background, centered,
```

**【表情だけ差し替える行】**

| 表情 | 末尾に足す1行 | 保存ファイル名 |
|------|------|------|
| 通常 | `neutral cheerful expression, relaxed mouth` | `assets/chara/ayaka_normal.png` |
| 笑顔 | `big radiant happy smile, eyes closed in joy, energetic` | `assets/chara/ayaka_smile.png` |
| 照れ | `shy blushing face, looking away slightly, flustered, small mouth` | `assets/chara/ayaka_shy.png` |
| 怒り | `pouting angry face, puffed cheeks, furrowed brows, comedic` | `assets/chara/ayaka_angry.png` |
| 驚き | `surprised face, wide open eyes, open mouth, raised eyebrows` | `assets/chara/ayaka_surprised.png` |

**【ネガティブ】**
```
detailed background, scenery, baseball field, multiple people, text, watermark, signature,
cropped head, out of frame, blurry, low quality, bad anatomy, extra limbs, deformed hands
```

> 顔を安定させるコツ：参考画像（野球少女）を i2i の参照に使い、表情の語だけ差し替える。

### 1-2. 壇ノ浦 凛桜（クーデレ・謎の転校生）

**キャラ固定文**：
```
1girl, Rio, high school girl, long silver hair, heterochromia (one purple eye one golden eye),
elegant blazer school uniform (purple blazer, gold ribbon), mysterious calm aura,
pale skin, star mark on cheek
```

| 表情 | 追加する語 | 保存ファイル名 |
|------|-----------|--------------|
| 通常 | `calm neutral expression, slight enigmatic look` | `assets/chara/rio_normal.png` |
| 微笑 | `gentle mysterious smile, soft eyes` | `assets/chara/rio_smile.png` |
| 真剣 | `serious expression, intense gaze` | `assets/chara/rio_serious.png` |
| 照れ | `subtle blush, slightly surprised, vulnerable look` | `assets/chara/rio_shy.png` |

### 1-3. 早瀬 すず（サッカー少女・第3ヒロイン）

> **参考画像あり**：黒髪ショートボブ、元気な笑顔、白＆ブルーのサッカーユニフォーム、夕暮れの河川敷。
> 決め台詞「『ボール』がヤキモチ焼いてるから、あっち行って！」

**キャラ固定文**：
```
1girl, Suzu, energetic high school soccer girl, short black bob hair, brown eyes,
lively cheerful smile, white and blue soccer uniform, knee-high socks,
riverbank at sunset background, athletic
```

| 表情 | 追加する語 | 保存ファイル名 |
|------|-----------|--------------|
| 通常 | `cheerful neutral expression` | `assets/chara/suzu_normal.png` |
| 笑顔 | `big playful grin, energetic` | `assets/chara/suzu_smile.png` |
| 照れ | `embarrassed blush, looking away, rare vulnerable look` | `assets/chara/suzu_shy.png` |
| 真剣 | `serious determined expression` | `assets/chara/suzu_serious.png` |

### 1-4. 田中 健二（親友・ムードメーカー）

**キャラ固定文**：
```
1boy, Kenji, high school boy, short spiky black hair, blue eyes, friendly face,
dark gakuran school uniform (Japanese boys uniform), cheerful energetic
```

| 表情 | 追加する語 | 保存ファイル名 |
|------|-----------|--------------|
| 通常 | `friendly neutral expression` | `assets/chara/kenji_normal.png` |
| 大笑い | `big laughing expression, closed eyes, open mouth` | `assets/chara/kenji_laugh.png` |
| 驚き | `shocked surprised expression` | `assets/chara/kenji_shocked.png` |

---

## 2. 背景（assets/bg/）

**背景の共通スタイル文**（人物を入れない）：
```
[共通スタイル] anime visual novel background art, no people, detailed scenery,
warm lighting, depth of field
```

| シーン | プロンプトに追加 | 保存ファイル名 |
|--------|---------------|--------------|
| 教室 | `Japanese high school classroom, sunny afternoon, desks by window` | `assets/bg/classroom.png` |
| 屋上 | `school rooftop, blue sky, fence, summer clouds` | `assets/bg/rooftop.png` |
| 廊下 | `school hallway, lockers, warm sunlight through windows` | `assets/bg/hallway.png` |
| 夕焼け教室 | `empty classroom at sunset, orange light, long shadows, nostalgic` | `assets/bg/sunset.png` |
| 図書室 | `school library, bookshelves, quiet warm atmosphere` | `assets/bg/library.png` |
| 商店街 | `nostalgic Japanese shopping street (shotengai), evening, retro shops` | `assets/bg/shop.png` |

> 背景は横長（1216×832 など）。スマホ縦画面に合わせるなら、中央が主役になる構図で。

---

## 3. イベントCG（assets/cg/）

ここが**感動シーンの主役**。アマガミのCGに相当する見せ場の一枚絵。横長（1216×832）。

**CGの共通スタイル文**：
```
[共通スタイル] emotional key visual / event CG for romance visual novel,
cinematic composition, dramatic lighting, character(s) and background fully rendered together
```

| シーン | プロンプトに追加 | 保存ファイル名 |
|--------|---------------|--------------|
| プロローグ | `Ayaka handing a pudding with a sticky note, classroom at sunset, shy happy face` | `assets/cg/cg_prologue.png` |
| 彩花の剛速球 | `Ayaka throwing a powerful fastball, sunset baseball field, dramatic motion, confident smile` | `assets/cg/cg_ayaka_fastball.png` |
| すずのリフティング | `Suzu doing soccer ball juggling at riverbank sunset, playful grin, comedic mood` | `assets/cg/cg_suzu_river.png` |
| 修羅場の出会い | `Ayaka and Rio facing each other tensely, hallway, comedic sparks between them` | `assets/cg/cg_first_clash.png` |
| 屋上告白(彩花) | `Ayaka confessing on rooftop at sunset, tearful smile, wind blowing ponytail` | `assets/cg/cg_ayaka_confess.png` |
| 凛桜の本心 | `Rio reaching out her hand for the first time, soft light, single tear` | `assets/cg/cg_rio_truth.png` |

> CGは物語の山場ごとに1枚。最初は彩花ルートの決定的シーン1〜2枚から作ると効果が高い。

---

## 4. その他のアセット（任意）

| 用途 | ファイル名 | メモ |
|------|----------|------|
| タイトルロゴ | `assets/title_logo.png` | 透過PNG。手描き文字風だと味が出る |
| UIアイコン | `assets/icon_*.png` | 現状は絵文字。差し替えたい場合 |

---

## 5. 制作の優先順位（コスパ順）

1. **彩花の表情5種**（メインヒロイン。一番画面に出る）
2. **背景：教室・夕焼け・廊下**（序盤で必ず使う）
3. **凛桜の表情4種**
4. **CG：プロローグ＋彩花告白**（感動の核）
5. 健二の表情・その他背景・残りのCG

> まず①②だけ作って差し込むだけでも、見た目は劇的に変わります。

---

## 6. 倫理・権利の注意

- 既存キャラ（実在の作品のキャラ名・固有の見た目）をそのまま生成するプロンプトは使わない。本作オリジナルの設定で生成すること
- 生成AIの利用規約・商用利用条件を必ず確認する
- 配布・販売する場合はライセンスに注意

---

*このガイドの表のファイル名どおりに置けば、index.html が自動で読み込みます。*
*無い絵は既存のSVG立ち絵が自動的に使われるので、1枚ずつ差し替えていけます。*
