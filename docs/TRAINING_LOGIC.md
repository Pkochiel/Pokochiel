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
  profile: SkillProfile        // 9スキルの状態（純粋な入力）
  passages: PassageCandidate[] // 各トレーニングに対応できるかのフラグを持つ
  recentPassageIds: string[]
  dueRecallCount: number
  targetCpm / chunkLevel / meaningFlashLevel / preferredDifficulty
}): DailyTrainingPlan
```

### 構成の考え方：コア + 任意ブロック

全トレーニングを毎日詰め込むと、1つあたりが短くなりすぎて訓練にならない。
そのため**毎日必ず行うコア**と、**Skill Profile に応じて選ぶ任意ブロック**に分ける。

| 区分 | トレーニング | 30分 | 20分 | 10分 |
|---|---|---|---|---|
| コア | Warm-up | 2 | 1 | 1 |
| コア | Speed Push | 5 | 4 | 2 |
| コア | Structure Reading | 6 | 4 | 2 |
| コア | Comprehension Test | 4 | 3 | 2 |
| コア | Immediate Recall | 4 | 3 | 1 |
| 任意 | 予算（合計） | 9 | 5 | 2 |

任意ブロックの候補と、それが鍛えるスキル：

```
Meaning Flash       → Meaning Extraction
Chunk Reading       → Chunk Recognition
Prediction Reading  → Prediction
Variable Speed      → Adaptive Reading
Regression Control  → Reading Speed
```

### 選択の手順

1. 翌日 Recall があれば、プラン先頭に差し込む（コアの外側・2分）
2. コア配分をベースとし、弱点に応じて時間を移す（供出元はベース配分の半分を保持）
3. 任意ブロックを **weak > unmeasured > normal > strong** の順で選ぶ
   - 既知の弱点の解消を最優先し、その次に「まだ測っていない」を優先する
   - 同順位のときは日付由来の回転で順番を変え、同じ内容が毎日続かないようにする
   - 対応教材がないトレーニング（Prediction の停止位置、Variable Speed の区間定義）は候補から外す
4. 予算を選ばれたブロックへ分配（1ブロック 2〜5分）
5. 教材を割り当てる。Speed Push / Chunk / Prediction / Variable Speed / Regression には別々の教材、
   Comprehension と Immediate Recall は Structure Reading と同じ教材（読んだものを問う）
6. 生成理由（`generatedReason`）を残す

**合計時間は必ず `totalMinutes` に一致する。** 同じ入力からは常に同じ構成が出る（乱数を使わない）。

### コア配分の重み付け（明示ルール）

| 状況 | 対応 |
|---|---|
| Reading Speed 弱 かつ Comprehension 中〜強 | Speed Push を増やす |
| Reading Speed 強 かつ Comprehension 弱 | **Speed Push を増やさない。** Structure Reading と Comprehension を増やす |
| Structure Recognition 弱 | Structure Reading を増やす |
| Immediate / Delayed Recall 弱 | **速度を落とすのではなく** Recall と Structure Reading を増やす |

**速度を上げることを常に成功とみなさない。** 上の2行目と4行目がその担保である。

## 6. Skill Profile（弱点判定の土台）

9スキルの定義・測定源・状態の分類は [METRICS.md](METRICS.md) §4 を参照。

配分に使う際の要点：

- `unmeasured` を弱点として扱わない（未測定と「測ったうえで弱い」は別）
- 実測が1つもない新規ユーザーには、コアの標準配分をそのまま使う
- 同じスコアでも高いレベルで達成したほうが高く評価される（レベル係数）

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

| # | Training | 鍛える認知能力 | 何で測るか | 記録する値 |
|---|---|---|---|---|
| 00 | Warm-up | 読む姿勢への切り替え | 測らない | cpm |
| 01 | Speed Push | Reading Speed | 目標速度で読み、直後に理解度を確認 | cpm, targetCpm, comprehension |
| 02 | Chunk Reading | Chunk Recognition | チャンク表示後の理解度 × レベル | level, comprehension |
| 03 | Meaning Flash | Meaning Extraction | 短時間露出後の意味選択の正答率 | accuracyScore, exposureMs, level |
| 04 | Structure Reading | Structure Recognition | 段落要旨の正答率 | comprehension |
| 05 | Prediction Reading | Prediction | 予測の論理方向と論点の合致 | accuracyScore |
| 06 | Variable Speed | Adaptive Reading | 区間ごとの選択速度と推奨帯の一致率 | accuracyScore |
| 07 | Regression Control | Reading Speed（無駄な読み戻りの抑制） | 読み戻り密度 × 理解度 | backCount, pauseCount, cpm, comprehension |
| 08 | Comprehension Test | Comprehension | 5種の設問の正答率 | comprehension |
| 09 | Immediate Recall | Immediate Recall | Key Point の照合 | immediateRecallScore |
| 10 | Next-day Recall | Delayed Recall | 同上（翌日） | recallScore（recall_tasks） |

### 各トレーニングの評価の要点

**Meaning Flash**（`core/training/meaning-flash.ts`）
設問は必ず「言いたかったことは何か」を問い、語句の再生を問わない。
表示時間はレベルで決まり、下限 800ms を下回らない（極端なフラッシュ表示をしない）。
正答率でレベルを上下させる ＝ 速さそのものではなく「速くしても意味が取れるか」を上げる。

**Prediction Reading**（`core/training/prediction.ts`）
完全一致を求めない。`correct`（論点まで一致）100点、`partial`（論理方向は一致）50点、`miss` 0点。
自由記述には加点するが、これは正確さではなく「予測を言語化したこと」への加点。

**Variable Speed Reading**（`core/training/variable-speed.ts`）
区間の情報価値（known / example / evidence / claim / key）に対する推奨帯との一致率で採点。
一致 100点、隣接帯 50点、正反対 0点。**主張・核心を fast で通過した場合は追加減点。**
全区間を速く読んでも 50点未満にしかならない ＝ CPM 競争にならない。

**Regression Control**（`core/training/regression.ts`）
読み戻しは禁止しない。読み戻り密度（1000字あたりの回数）と理解度を対で評価する。

```
読み戻り減 かつ 理解度維持        → improved
読み戻り減 だが 理解度が15pt以上低下 → too_fast（取りこぼしたまま進んでいる）
読み戻りが1000字あたり8回超       → needs_more_control
```

回数の少なさだけでは良いと判断しない。

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

## 11-b. トレーニング後のフィードバック

`core/feedback/feedback.ts`。スコアの再掲ではなく「次に何を変えるか」を1〜2文で返す。

| 状況 | 返す内容 |
|---|---|
| 速度上昇 かつ 理解維持 | 肯定（この速度帯が身についてきている） |
| 速度上昇 かつ 理解低下 | 注意（次回は速度を戻す） |
| Variable Speed で主張を速く通過 | 注意（どこで落とすべきだったか） |
| Meaning Extraction 強 かつ Delayed Recall 弱 | 注意（直後に書き出す時間を増やす） |
| Reading Speed 強 かつ Comprehension 弱 | 注意（速度は上げない） |

**速度が上がったこと自体を成果として扱わない。** 理解が落ちていれば肯定的な文言を返さない。
`FeedbackGenerator` インタフェース経由で呼ぶため、AI Coach への差し替えは実装の入れ替えだけで済む。

## 12. ユニットテスト対象（必須）

```
core/metrics/cpm.test.ts                     CPM 計算・invalid 判定・境界値
core/metrics/ers.test.ts                     ERS 計算・欠損時 null・極端な CPM の影響
core/metrics/baseline-profile.test.ts        中央値・外れ値の除外・タイプ別内訳・再測定
core/metrics/recall.test.ts                  Key Point 照合・自己評価が主要値を上書きしないこと
core/metrics/skill-profile.test.ts           4状態の分類・未測定の扱い・レベル係数・傾向
core/metrics/difficulty.test.ts              DifficultyFactors → difficulty の整合
core/adaptive/speed.test.ts                  閾値 0.85 / 0.7、クランプ、サンプル不足時 hold
core/adaptive/training-selection.test.ts     弱点優先・未測定の優先度・回転・コア重み付け
core/planner/daily-plan.test.ts              合計分数の保存、決定性、教材の対応、弱点反映
core/training/meaning-flash.test.ts          露出時間の下限・レベル昇降
core/training/prediction.test.ts             論理方向の部分点・記述加点・上限
core/training/variable-speed.test.ts         一致率・主張の読み飛ばし減点・速読で高得点にならないこと
core/training/regression.test.ts             読み戻り減 × 理解低下 → too_fast の判定
core/feedback/feedback.test.ts               速度上昇を無条件に肯定しないこと・差し替え可能性
core/scheduler/recall-schedule.test.ts       翌日算出・TZ・期限切れ・重複防止
core/chunking/segment.test.ts                レベル別の窓、意味単位を割らないこと、下限表示時間
core/session/baseline-flow.test.ts           記述確定前に Key Points を見せないこと
core/session/timer.test.ts                   ポーズ・非表示中の除外
```

E2E（Playwright）：

- `Baseline → 理解度8問 → Key Point 照合 → 結果` が完走し、理解の内訳まで保存されること
- 2回目の Baseline で別の教材が出ること
- `Daily Training`（Meaning Flash / Prediction / Variable Speed を含む）→ `Recall` → `Dashboard`
  が完走し、各トレーニングの結果が保存されること
- Progress のチャートと Skill Profile が表示され、表形式でも確認できること
