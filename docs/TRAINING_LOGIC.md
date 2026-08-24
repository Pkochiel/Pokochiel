# Speed Reading Lab — Training Logic

すべての閾値・係数は設定ファイルに集約する。**ロジック内に数値リテラルを直接書かない。**
本書の関数はすべて `src/core` の純粋関数として実装し、Vitest で検証する。

**この文書が扱うのは、BTR の外に残っている部分だけである。**
Baseline 測定・翌日の想起・読書速度（CPM）がそれにあたる。

BTR の種目そのもの（13種目の作り、級の進み方、1回の組み立て）は
[BTR_METHOD.md](BTR_METHOD.md) にある。設定は種目ごとに
`src/core/training/btr/*.ts` へ置き、はしごは `progression.ts` にまとめてある。

## 0. 設定の置き場所

| 置き場所 | 中身 |
|---|---|
| `src/core/config/training-config.ts` | 読書・想起・難易度・教材の要件（BTR の外に残った分） |
| `src/core/training/btr/<種目>.ts` | 種目ごとの盤面の大きさ・問題数・制限時間の段 |
| `src/core/training/btr/progression.ts` | 級のはしご（段ごとの制限時間と、上がる・下がる条件） |
| `src/core/planner/btr-session.ts` | 1回の組み立て（長さごとの型） |

## 1. CPM

```
CPM = characterCount / elapsedSeconds * 60
```

- `characterCount` は空白・改行を除いた本文文字数（教材側で確定し、実行時に再計算しない）。
- `elapsedSeconds` は `performance.now()` 実測から**ポーズ時間と非表示時間を差し引いた**値。
- `elapsedSeconds < READING.minReadingSeconds` または `CPM > READING.maxPlausibleCpm` の場合、
  結果は保存するが `valid = false` とし、統計・適応計算から除外する。

```ts
calculateCpm({ characterCount, elapsedSeconds }): { cpm: number; valid: boolean }
```

## 2. Comprehension Score

```
comprehension = 正答数 / 出題数 * 100      (0–100)
```

MVP では設問の重み付けをしない。ただし教材品質として次を**テストで強制**する。

- 設問は5問以上
- `main_idea` / `detail` / `cause_effect` / `inference` / `structure` のうち4種以上を含む
- `inference` を最低1問含む（単純な暗記問題だけにしない）

## 3. Recall Score

**Immediate Recall（直後）**

1. 本文を完全に隠す
2. 「今読んだ内容を、見ずに3〜5項目で再現してください」で自由入力
3. **入力を確定した後に** Key Points を表示する
4. `RECALL.selfAssessmentSteps`（0/25/50/75/100）から自己評価

入力テキスト（`recall_text`）は必ず保存する。Phase 4 の LLM 意味的一致度評価は、この蓄積を再スコアリングして導入する。
自己申告の水増しを防ぐため、**テキスト確定前は評価UIを出さない**（順序が指標の質を決める）。

**Delayed Recall（翌日）**

同じ手順を、本文非表示・翌日に実施。`recall_tasks` の結果として保存し、長期記憶指標とする。

## 4. Effective Reading Score (ERS)

```
ERS = CPM × comprehension01 × recall01
（comprehension01, recall01 はいずれも 0〜1）

例： 1500 × 0.8 × 0.7 = 840
```

- `recall01` には **Immediate Recall** を使う（当日確定するため）。
- 翌日 Recall が確定した後は `RetainedERS = CPM × comprehension01 × delayedRecall01` を別指標として算出する。
- 欠損時は ERS を算出しない（`null`）。欠損を 0 や 1 で埋めない。
- **絶対的な能力指数として扱わず、UI では常に内訳と併記する。**

## 5. Recall のスケジューリング

```ts
scheduleRecallTasks(input: { passageId, sessionId, completedOn: LocalDate, timezone })
  : RecallTask[]
```

- `RECALL.intervalsDays = [1]` → `scheduled_date = completedOn + 1`（ユーザーTZの日付で計算）。
- `expires_on = scheduled_date + RECALL.windowDays`。超過は `expired` とし、遅れて実施した結果を長期記憶指標に混ぜない。
- 同一 `(user, passage, scheduled_date)` は一意。重複生成しない。
- 将来 `[1, 3, 7]` に拡張しても、この関数の戻り値が増えるだけで呼び出し側は変わらない。

## 6. 続けている日数

- BTR の記録（`btrResults.localDate`、ユーザーTZ）の連続日数。
- 1日に何回やっても 1 と数える。
- **今日まだやっていない日を切らしたことにしない。**
  夜にやる人が朝に開いたときに 0 と出ると、続いていたものが切れたように見える。
  今日か昨日に記録があれば、そこから数えはじめる。
- **速度だけを伸ばすゲームにしないため**、記録の更新には紐付けない。

## 7. ユニットテスト対象（必須）

BTR の種目とはしご：

```
core/training/btr/saccade.test.ts            往復の数え方・たてよこの切り替え・重複押下
core/training/btr/speed-check.test.ts        毎問違うお題・1字違いを全部並べること・正答率の分母
core/training/btr/number-random.test.ts      1から順に拾う判定・複数枚の合成
core/training/btr/pattern-sheet.test.ts      縦書き80列の盤面・発見数と到達列
core/training/btr/bp-sheet.test.ts           現れて消える時刻・消えた字を押せないこと
core/training/btr/unit-book.test.ts          よく似た8文の作り分け・正答数
core/training/btr/kana-pickup.test.ts        拾い率・読んだ範囲の見落とし・級の判定
core/training/btr/logical-test.test.ts       前提がつながらない出題・3択である必要
core/training/btr/speed-board.test.ts        盤の外へ出ないこと・同じ向きを続けないこと
core/training/btr/image-memory.test.ts       2セットのうち良いほうを主スコアにすること
core/training/btr/breathing.test.ts          少ないほうがよい印が落ちないこと
core/training/btr/paced-reading.test.ts      分速・3倍の判定・記録として弾く条件
core/training/btr/progression.test.ts        段ごとの制限時間・上がる下がるの条件・記録からの復元
core/planner/btr-session.test.ts             長さごとの合計・必ず入る種目・日替わりの回転
core/metrics/btr-progress.test.ts            種目ごとのまとめ・向きの判定・続けている日数
```

BTR の外に残っている部分：

```
core/metrics/cpm.test.ts                     CPM 計算・invalid 判定・境界値
core/metrics/ers.test.ts                     ERS 計算・欠損時 null・極端な CPM の影響
core/metrics/baseline-profile.test.ts        中央値・外れ値の除外・タイプ別内訳・再測定
core/metrics/recall.test.ts                  Key Point 照合・自己評価が主要値を上書きしないこと
core/metrics/difficulty.test.ts              DifficultyFactors → difficulty の整合
core/adaptive/speed.test.ts                  閾値 0.85 / 0.7、クランプ、サンプル不足時 hold
core/chunking/segment.test.ts                レベル別の窓、意味単位を割らないこと
core/session/baseline-flow.test.ts           記述確定前に Key Points を見せないこと
core/session/timer.test.ts                   ポーズ・非表示中の除外
core/scheduler/recall-schedule.test.ts       翌日算出・TZ・期限切れ・重複防止
data/content/kana-stories.test.ts            課題文の長さ・対象の密度・問いの散らばり
data/content/image-words.test.ts             具体物であること・分野が固まらないこと・1列に収まる長さ
data/reading-books.test.ts                   本の登録・桁外れの入力を弾くこと・控えの上限
```

E2E（Playwright）：

- 長さを選ぶと、その長さぶんの献立が組まれること
- 種目を終えると、その場で §5 の形の記録が残ること
- 残った記録が次の回の級（＝制限時間）を決めること
- `Baseline → 理解度8問 → Key Point 照合 → 結果` が完走し、理解の内訳まで保存されること
- 2回目の Baseline で別の教材が出ること
- 推移に種目ごとの数字と読書の伸びが出ること
- オフラインで起動し、書いた内容が残ること
