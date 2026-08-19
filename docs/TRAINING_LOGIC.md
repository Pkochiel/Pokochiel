# Speed Reading Lab — Training Logic

すべての閾値・係数は `src/core/config/training-config.ts` に集約する。**ロジック内に数値リテラルを直接書かない。**
本書の関数はすべて `src/core` の純粋関数として実装し、Vitest で検証する。

## 0. training-config.ts（初版）

```ts
export const READING = {
  minReadingSeconds: 3,        // これ未満の計測は invalid
  maxPlausibleCpm: 6000,       // これを超える計測は invalid（誤操作対策）
  baselineStartMultiplier: 1.15,
} as const

export const SPEED_ADAPTATION = {
  highComprehension: 0.85,
  lowComprehension: 0.7,
  increaseRate: 0.05,
  decreaseRate: 0.05,
  minMultiplierOfBaseline: 0.8,
  maxMultiplierOfBaseline: 2.5,
  minQuestionsForAdaptation: 4,   // 設問が少なすぎる回では速度を動かさない
  recentWindow: 5,                // 直近 N 件の実績を見る
} as const

export const RECALL = {
  selfAssessmentSteps: [0, 25, 50, 75, 100],
  intervalsDays: [1],          // MVP は翌日のみ。将来 [1,3,7] に拡張
  windowDays: 3,               // scheduled_date から N 日で expired
  lowRecallThreshold: 50,      // これ未満なら Recall/Structure の配分を増やす
} as const

export const CHUNKING = {
  levels: {
    1: { minChars: 5,  maxChars: 8  },
    2: { minChars: 8,  maxChars: 15 },
    3: { minChars: 15, maxChars: 25 },
    4: { unitsPerChunk: 1 },          // 意味単位そのまま
    5: { unitsPerChunk: 3 },          // 複数意味単位
  },
  minDisplayMs: 250,          // 光感受性リスク帯（>3Hz）に入らないための下限
  maxDisplayMs: 4000,
  levelUpAccuracy: 0.85,
  levelDownAccuracy: 0.6,
} as const

export const PLAN = {
  presets: {
    30: { warmup: 3, speed_push: 5, chunk_reading: 5, structure_reading: 7, comprehension: 5, immediate_recall: 5 },
    20: { warmup: 2, speed_push: 4, chunk_reading: 3, structure_reading: 5, comprehension: 3, immediate_recall: 3 },
    10: { warmup: 1, speed_push: 2, chunk_reading: 2, structure_reading: 2, comprehension: 2, immediate_recall: 1 },
  },
  reallocationRatio: 0.2,     // 総時間のこの割合までを弱点ブロックへ移す
  blockMinMinutes: 1,
} as const

export const SCORING = {
  comprehensionPassThreshold: 70,
  recentWindow: 5,
  skillRadarSpeedCeiling: 2.0,   // baseline の何倍を 100 点とするか
  delayedRecallWeight: 0.6,      // Recall 軸における翌日想起の重み
} as const
```

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

## 5. Daily Training Plan の生成

```ts
generateDailyPlan(input: {
  date: LocalDate
  totalMinutes: 10 | 20 | 30
  stats: UserStatsSnapshot     // 直近実績（純粋な入力。DB 参照はしない）
  passages: TrainingPassage[]  // 選択候補
  dueRecallTasks: RecallTask[]
}): DailyTrainingPlan
```

手順：

1. **翌日 Recall を最優先**。`dueRecallTasks` があれば、プラン先頭に `delayed_recall` ブロックを差し込む（1〜2分）。
2. `PLAN.presets[totalMinutes]` をベース配分とする。
3. 弱点スコア（§6）を算出し、`PLAN.reallocationRatio × totalMinutes` 分を上位の弱点ブロックへ移す。
   - 供出元は強い順、受け取りは弱い順。`blockMinMinutes` を下回らせない。
   - 同点時はブロック定義順で解決し、**同じ入力からは常に同じプランが出る**（決定的）。
4. 目標速度 `targetCpm` を §7 で決定。
5. 教材選択：直近 N 日に使った `passageId` を除外し、`difficulty` がユーザーの理解度レンジに合うものから選ぶ。
   同一セッション内では Speed Push / Chunk / Structure に**別々の教材**を割り当てる（Comprehension と Immediate Recall は Structure と同一教材を共有する ＝ 読んだものを問う）。
6. 生成理由（`generated_reason`）を残す。Phase 4 の AI Coach はこれを説明文に変換するだけでよい。

```ts
interface PlanBlock {
  order: number
  type: TrainingType
  minutes: number
  passageId?: string
  targetCpm?: number
  chunkLevel?: 1|2|3|4|5
  reason?: string
}
```

## 6. 弱点判定（Weakness Detection）

直近 `SCORING.recentWindow` 件の有効な結果から、6軸を 0–100 に正規化する（Skill Radar と同じ値を使う）。

| 軸 | 算出 |
|---|---|
| Reading Speed | `clamp01(meanCpm / (baselineCpm × skillRadarSpeedCeiling)) × 100` |
| Chunking | Chunk Reading の正答率 × `level / 5` を 0–100 に |
| Structure | Structure Reading の段落要旨正答率 |
| Comprehension | 理解度テストの平均 |
| Recall | `immediate × (1 - delayedRecallWeight) + delayed × delayedRecallWeight` |
| Adaptive Reading | Variable Speed で「推奨速度帯と一致した区間の割合」 |

弱点スコア = `100 - 軸スコア`。データが不足している軸（有効サンプル < 2）は**中央値扱い（50）**とし、極端な配分を避ける。

配分ルール（仕様の明示要件）：

- Recall が `RECALL.lowRecallThreshold` 未満 → **速度を極端に下げるのではなく**、`immediate_recall` と `structure_reading` の配分を増やす。
- Chunking が弱い → `chunk_reading` の配分を増やす。
- Comprehension が低い → `structure_reading` と `comprehension` を増やし、速度は §7 で下げる。

## 7. 速度適応（Speed Adaptation）

```
comprehension >= 0.85  → targetCpm × (1 + 0.05)
0.70 – 0.84            → 維持
< 0.70                 → targetCpm × (1 - 0.05)
```

- 初期値：`baselineCpm × READING.baselineStartMultiplier`（= 1.15倍）
- 出題数が `SPEED_ADAPTATION.minQuestionsForAdaptation` 未満の回は**適応を行わない**（ノイズで振らせない）。
- 直近 `recentWindow` 件の平均理解度で判定する（1回の結果で乱高下させない）。
- 結果は `[baselineCpm × 0.8, baselineCpm × 2.5]` にクランプする。**極端な速度を追求しない。**

```ts
adaptSpeed(input: { currentTargetCpm, baselineCpm, recentComprehension: number[], questionCount: number })
  : { targetCpm: number; direction: 'up'|'hold'|'down'; reason: string }
```

## 8. Chunk Reading のレベル制御

教材の `chunks` は**意味単位（原子）**。レベルは「原子をどうグループ化して見せるか」で決まる。

| Level | 表示単位 |
|---|---|
| 1 | 5〜8文字（原子が長い場合のみ助詞境界で分割） |
| 2 | 8〜15文字（原子を結合して窓に合わせる） |
| 3 | 15〜25文字 |
| 4 | 意味単位そのまま（原子1つ） |
| 5 | 複数意味単位（原子3つ程度） |

**原子の内部は原則として割らない。** 窓を超える場合のみ、ヒューリスティック分割器で助詞・句読点境界を探して割る。

表示時間：

```
displayMs = clamp(chunkChars / (targetCpm / 60) * 1000, minDisplayMs, maxDisplayMs)
```

`minDisplayMs = 250ms` は光感受性発作リスク（毎秒3回超の明滅）を避けるための**安全下限**であり、設定で下回れないようにする。

レベル昇降：直近のチャンク理解度が `levelUpAccuracy (0.85)` 以上で +1、`levelDownAccuracy (0.6)` 未満で −1。

## 9. 各トレーニングの評価定義

| # | Training | 目的 | 記録する値 |
|---|---|---|---|
| 01 | Speed Push | 普段より少し速い速度で読む経験を作る | cpm, targetCpm, comprehension |
| 02 | Chunk Reading | 文字単位でなく意味のまとまりで認識する | chunkLevel, accuracy, displayMs |
| 03 | Meaning Flash | 意味抽出速度（文字列記憶ではない） | accuracy, exposureMs |
| 04 | Structure Reading | 段落の主張を掴む（速読の中核） | 段落要旨の正答率 |
| 05 | Prediction Reading | 仮説を持って読む | 予測入力、自己一致度 |
| 06 | Variable Speed | 重要度に応じて速度を変える | 区間ごとの選択速度と推奨帯の一致率 |
| 07 | Regression Control | 無駄な読み戻りの抑制（禁止はしない） | backCount, pauseCount, cpm |
| 08 | Comprehension Test | 理解の測定 | 0–100 |
| 09 | Immediate Recall | 直後想起 | 0–100 + テキスト |
| 10 | Next-day Recall | 長期記憶 | 0–100 + テキスト |

**Regression Control の設計原則：読み戻りを禁止しない。** ユーザーが必要と判断すれば戻れる。
結果画面で Back 回数 / Pause 回数 / 速度を提示し、判断材料を返すに留める。

**Variable Speed** は教材に区間ラベル（`known` / `example` / `evidence` / `claim` / `key`）と推奨速度帯を持たせ、
ユーザーの `←(Slow) / Space(Normal) / →(Fast)` 選択との一致率を Adaptive Reading 軸として採点する。
スマホでは画面下部の3ボタンで同じ操作を提供する。

## 10. Recall のスケジューリング

```ts
scheduleRecallTasks(input: { passageId, sessionId, completedOn: LocalDate, timezone })
  : RecallTask[]
```

- `RECALL.intervalsDays = [1]` → `scheduled_date = completedOn + 1`（ユーザーTZの日付で計算）。
- `expires_on = scheduled_date + RECALL.windowDays`。超過は `expired` とし、遅れて実施した結果を長期記憶指標に混ぜない。
- 同一 `(user, passage, scheduled_date)` は一意。重複生成しない。
- 将来 `[1, 3, 7]` に拡張しても、この関数の戻り値が増えるだけで呼び出し側は変わらない。

## 11. Streak

- `training_sessions.local_date`（ユーザーTZ）の連続日数。
- 1日に複数セッションを実施しても 1 とカウントする。
- **速度だけを伸ばすゲームにしないため**、Streak は「完了したセッション」に対して付与し、記録更新には紐付けない。

## 12. ユニットテスト対象（必須）

```
core/metrics/cpm.test.ts               CPM 計算・invalid 判定・境界値
core/metrics/ers.test.ts               ERS 計算・欠損時 null・0〜1 変換
core/metrics/difficulty.test.ts        DifficultyFactors → difficulty の整合
core/metrics/skill-radar.test.ts       6軸正規化・サンプル不足時の 50 扱い
core/adaptive/speed.test.ts            閾値 0.85 / 0.7、クランプ、サンプル不足時 hold
core/adaptive/weakness.test.ts         低 Recall 時に速度を落とさず配分を変えること
core/planner/daily-plan.test.ts        合計分数の保存、決定性、最小分数、Recall 差し込み
core/scheduler/recall-schedule.test.ts 翌日算出・TZ・期限切れ・重複防止
core/chunking/segment.test.ts          レベル別の窓、意味単位を割らないこと、下限表示時間
core/session/reducer.test.ts           セッション進行（開始→各ブロック→結果）の遷移
```

E2E（Playwright）：`Baseline → Dashboard → Training → Result` が完走すること。
