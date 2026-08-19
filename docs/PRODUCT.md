# Speed Reading Lab — Product Definition

## 1. コンセプト

**読む速度を上げるのではなく、「速く理解し、必要な情報を選び、後から思い出せる能力」を鍛える。**

このプロダクトは「文字を高速表示するアプリ」ではない。鍛える対象は次のパイプライン全体である。

```
高速視認 → 意味認識 → 構造化 → 重要度判断 → 速度切替 → 理解 → 想起 → 長期記憶
```

このパイプラインが、UX / Training Logic / Metrics のすべての設計判断の基準となる。
機能追加の是非は「このパイプラインのどの段を鍛えるのか」で判断する。答えられない機能は入れない。

## 2. 提供しないもの（明示的な非目標）

科学的根拠が弱い、以下の能力を成果として謳わない。UI 文言・マーケティング文言でも使用しない。

- ページを写真のように丸暗記する
- 脳内音読（subvocalization）を完全に消す
- 一瞬見ただけで全文を記憶する
- 「1分で1冊」といった速度単体の誇張

速度は指標のひとつに過ぎない。速度単体で最適化されるゲームにはしない。

## 3. ターゲットとユースケース

- 日本語のビジネス文書・技術文書・記事を日常的に大量に読む社会人
- 1日20〜30分を継続的に投下できる
- Windows PC（腰を据えたトレーニング）と スマートフォン（隙間時間・翌日Recall）の双方で使う

## 4. 中心導線

```
ログイン → Dashboard → Today's Training
  → ウォームアップ → 高速読解 → チャンク認識 → 構造把握
  → 理解度テスト → 白紙想起 → 結果 → （翌日）Recall
```

**原則：「今日は何をやればいいのか」をユーザーに考えさせない。**
Dashboard の主役は Today's Training の単一 CTA であり、メニュー選択ではない。
トレーニング構成はアプリ側が当日の実力・弱点・所要時間設定から自動生成する。

## 5. 言語方針（日本語ファースト）

- 第一言語は日本語。主要な速度指標は **CPM（Characters Per Minute）**。
- WPM は英語対応時の派生指標として後日追加する（`ReadingSpeedUnit` を型で分離しておく）。
- 日本語特有の要件：文節・意味単位でのチャンク分割、句読点・括弧の扱い、全角文字幅を前提とした組版。

## 6. 主要指標（ユーザーに見せる数値）

| 指標 | 定義 | 目的 |
|---|---|---|
| CPM | 本文文字数 ÷ 読書秒数 × 60 | 読書速度 |
| Comprehension | 理解度テスト正答率 0–100 | 理解 |
| Immediate Recall | 直後の白紙想起 0–100 | 即時想起 |
| Next-day Recall | 翌日の想起 0–100 | 長期記憶 |
| ERS (Effective Reading Score) | CPM × comprehension(0–1) × recall(0–1) | 速度・理解・記憶の複合 |
| Training Streak | 連続実施日数 | 継続 |

**ERS は実験的な内部指標であり、絶対的な能力指数として扱わない。**
UI では「速さだけではなく、理解・記憶を含めた読書性能」と説明し、常に内訳（CPM / 理解 / 想起）と併記する。

## 7. Skill Radar（能力の可視化軸）

```
Reading Speed / Chunking / Structure / Comprehension / Recall / Adaptive Reading
```

MVP ではレーダーチャート描画自体は後回しでよいが、**6軸のスコアは MVP 時点から算出・保存する**。
（後からチャートを足すだけで済むよう、データ側を先に用意する。）

## 8. Gamification 方針

補助的にのみ使用する。実装候補：Streak / XP / Level / Personal Best / Weekly Goal。

- **速度だけを上げるゲームにしない。** XP 付与は `Speed × Understanding × Memory` を掛け合わせた達成に対して行う。
- 理解度が閾値未満のセッションでは速度更新を Personal Best として記録しない。
- 派手な演出は行わない（集中の妨げになるため）。

## 9. MVP スコープ

**必須**

Baseline Test / Dashboard / Daily Training / Speed Push / Chunk Reading / Structure Reading /
Comprehension Test / Immediate Recall / Progress Tracking / Local Seed Content

**MVP では実装しない**

AI 生成 / SNS / ランキング / 課金 / コミュニティ / PDF Import / Obsidian 連携 / 高度な Gamification

## 10. Definition of Done（MVP 完了条件）

新規ユーザーが、以下をエラーなく一連で完了できること。

1. アプリを開く
2. Baseline Test を受ける
3. 自分の CPM と理解度を知る
4. Daily Training を開始する
5. Speed / Chunk / Structure を訓練する
6. Comprehension Test を実施する
7. Recall を実施する
8. Dashboard で成長を見る

この一連が Playwright の E2E で自動的に完走することを、DoD の機械的な判定基準とする。

## 11. コンテンツ方針

- **著作権上問題のある書籍本文を転載しない。** 教材はすべてこのプロジェクト用のオリジナル日本語文章。
- カテゴリ：Business / Technology / Economics / Psychology / Science / History / General
- MVP では 20〜30 本を Seed Data として用意（Step 4 の最低要件は 10 本）。
- 将来的にユーザー自身の記事・PDF・ノートを教材化できるよう、教材の取り込み口を型で抽象化しておく（MVP では実装しない）。

## 12. デザイン原則

コンセプトは **「集中できる学習ツール」**。派手なゲーム UI にはしない。

- 参考とする方向性：Linear（情報密度と静けさ）、Notion（タイポグラフィ）、Apple Health（指標の見せ方）、Duolingo（進捗設計の考え方のみ）。**いずれも完全コピーはしない。**
- Color：White / Black / Navy / Blue / Gray + アクセント1色
- Typography：本文は十分な行間・読みやすい文字サイズ・distraction-free
- Reading Mode ではナビゲーション等を極力消す
