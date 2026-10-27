# Speed Reading Lab — Persistence

学習記録がどこに、どういう形で保存され、アプリを更新しても失われないための
仕組みがどう組まれているかをまとめる。

**前提：** クラウドは存在しない。アカウント登録も同期もなしに、
記録は端末の中だけで完結する（docs/ARCHITECTURE.md §4）。

## 1. 層の構成

```
features / core                     ← 保存技術を知らない
      ↓
TrainingRepository                  ← ドメインの言葉。UI が依存する唯一の境界
      ↓
RecordStore                         ← 「id を持つレコードを collection に置く」だけ
      ↓
IndexedDbRecordStore  /  LocalStorageRecordStore  /  MemoryRecordStore
```

| 層 | 置き場所 | 責務 | 知っていること |
|---|---|---|---|
| `TrainingRepository` | `src/data/repositories/` | 既定値・重複排除・期限切れ・時系列整列・zod 検証 | ドメイン型 |
| `RecordStore` | `src/data/persistence/record-store.ts` | list / get / put / putMany / remove / clear | id と collection だけ |
| アダプタ | `src/data/persistence/` | 保存技術そのもの | IndexedDB / localStorage / メモリ |

### 守っている境界

- **`TrainingRepository` のシグネチャは Phase 1 から変えていない。** 全メソッドが
  最初から `Promise` を返していたため、同期の localStorage から非同期の IndexedDB へ
  移しても UI は 1 行も変わらなかった。
- **IndexedDB 固有の型と API は `src/data/persistence/indexeddb/` の外に出さない。**
  UI・Core Domain・Repository のいずれにも漏れていないことを
  `src/data/__tests__/persistence-encapsulation.test.ts` が機械的に固定する。
- **`RecordStore` は順序を保証しない。** IndexedDB は id 順で返すため、
  Repository が `createdAt` 昇順に整列する。trend 判定・直近 N 件・最新 Baseline は
  並び順に意味を持たせており、保存先の都合を指標に混ぜない。
- 3 つの実装は同じ契約テスト（`record-store-contract.ts`）を通る。
  保存先を増やすときは、このテストを通すことが受け入れ条件になる。

## 2. 起動時に決まること

`createLocalFirstStore()`（`persistence/create-store.ts`）が初回アクセス時に一度だけ行う。

1. **IndexedDB を開く。** 開けない環境（プライベートモード等）や 3 秒で応答が
   ない場合は **localStorage の実装に退避する**。保存先が理想的でなくても
   トレーニングは止めない。
2. **Phase 1 の `srl:v1:*` が残っていれば IndexedDB へ移送し、旧キーを削除する。**
   移動であって複製ではないので、正となる保存先は常に 1 つ。
   id 単位の upsert なので、途中で中断されても次の起動でやり直せる。

この 2 つを `DeferredRecordStore` の内側に閉じることで、`getRepository()` は
同期関数のまま保てる（呼び出し側は Repository のメソッドを await するだけでよい）。

## 3. IndexedDB スキーマと migration

データベース名 `speed-reading-lab`。object store は collection と 1 対 1、`keyPath` は `id`。

### migration の考え方

**「DB を消して作り直す」は通常経路では使わない。** version ごとの migration を
積み上げ、古い端末がどの version から来ても順に適用して現在の形へ持ち上げる。

```
端末に保存されている version（oldVersion）
      ↓  pendingMigrations で必要なものだけ選ぶ
v2 の migration → v3 の migration → …
      ↓
現在のスキーマ
```

`src/data/persistence/indexeddb/migrations.ts`

```ts
export interface SchemaMigration {
  readonly version: number       // 適用し終えた時点の DB version
  readonly description: string
  readonly apply: (context: MigrationContext) => void  // versionchange 内で同期実行
}

export const SCHEMA_MIGRATIONS: readonly SchemaMigration[] = [
  { version: 1, description: 'collection ごとの object store を作る', apply: ... },
]
export const DATABASE_VERSION = /* SCHEMA_MIGRATIONS の最大 version */
```

- **並びは追記のみ。** 既存の要素を書き換えると、その version を通過済みの端末に
  変更が届かず、端末ごとにスキーマがずれる。
- `DATABASE_VERSION` は並びから導出する。migration を足せば version は自動で上がる。
- 用意しているヘルパは 2 つ。
  - `createCollection(context, name)` — object store を作る
  - `transformCollection(context, name, fn)` — 既存レコードを 1 件ずつ書き換える
    （フィールドの改名・既定値の補完。`null` を返した行は削除）

### migration を追加する手順

1. `SCHEMA_MIGRATIONS` の**末尾に**要素を足す（version は +1）。
2. `migrations.test.ts` に、その migration で既存データがどうなるかのテストを足す。
3. `durability.test.ts` の「アプリ更新」シナリオが通ることを確認する。
4. docs/DATA_MODEL.md のスキーマ表と docs/RELEASE.md の履歴を更新する。

### 失敗したとき

migration が例外を投げた場合、versionchange トランザクションを**明示的に abort** する。

- DB は元の version のまま残り、保存済みの記録は失われない
- 開く操作は reject し、アプリはエラーとして扱う（黙って空の状態にはしない）
- 旧版のアプリで開き直せば、それまでどおり使える

この挙動は `durability.test.ts`「migration の失敗」で固定している。

### 自己修復（fallback）

当アプリの migration を通っていない DB（外部で作られた、object store が足りない等）に
当たったときだけ、version を上げて**足りない store を足す**。データは削除しない。
これは通常経路ではなく最後の手段であり、正常系は必ず version migration を通る。

## 4. localStorage（退避先・移送元）

キーは Phase 1 と同じ `srl:v1:<entity>`。IndexedDB が使えない環境ではこの形式のまま動く。

```
srl:v1:profile        Profile（単体オブジェクト）
srl:v1:sessions       TrainingSession[]
srl:v1:results        TrainingResult[]
srl:v1:reading_tests  ReadingTest[]
srl:v1:recall_tasks   RecallTask[]
srl:v1:plans          DailyTrainingPlan[]
```

移送元と退避先で同じ形式を使うのは、どちらの経路でも端末に残った記録を読み落とさないため。

## 5. Backup（端末の外へ出す唯一の経路）

```
Backup ファイル
   ↓ detectBackupVersion   … 当アプリの形式か / どの版か
   ↓ migrateBackup         … 旧形式を現在の形へ
   ↓ envelope の zod 検証   … 封筒の形
   ↓ 行ごとの zod 検証      … ドメインのスキーマ。通らない行は件数だけ報告して除外
   ↓ clear → putMany       … 全検証を通してから置き換える
IndexedDB
```

現在の形式（`schemaVersion: 2`）:

```jsonc
{
  "format": "speed-reading-lab.backup",
  "schemaVersion": 2,
  "exportedAt": "2026-08-20T00:00:00.000Z",
  "appVersion": "0.1.0",
  "data": { "profile": [], "sessions": [], "results": [], "readingTests": [], "recallTasks": [], "plans": [] }
}
```

| version | 形 | 扱い |
|---|---|---|
| 1 | `{ format, version, exportedAt, collections }` | `BACKUP_MIGRATIONS` で 2 へ変換して取り込む |
| 2 | 上記 | 現行 |

- **旧 backup を読めることは永続的な責務。** ユーザーが持っているファイルは後から
  書き換えられない以上、変換はアプリ側が持ち続ける。`BACKUP_MIGRATIONS` も追記のみ。
- 未来の `schemaVersion` は**推測で読まない**（`reason: 'version'` で拒否）。
  知らない構造を推測で読むと、黙って壊れたデータが入る。
- 拒否の理由は 3 つに分ける：`format`（当アプリのファイルでない）/
  `version`（新しすぎる）/ `corrupt`（形式は合っているが中身が読めない）。
- **拒否したときは既存データに触らない。** 特に「`collections` が無い v1 ファイル」を
  空とみなして全消去する事故を起こさないよう、欠けている場合は既定値で埋めずに拒否する。

UI が見るのは `BackupService`（`createSnapshot` / `restoreSnapshot`）だけで、
collection の構造も IndexedDB も version 変換も画面側には出さない。

## 6. 将来の Sync Engine

```
TrainingRepository
      ↓
RecordStore  ←── SyncingRecordStore（デコレータ）を 1 枚挟むだけ
      ↓                    ↓
IndexedDbRecordStore   Sync Engine ──→ Supabase
```

- 差し込み位置は `createLocalFirstStore()` の 1 箇所。
  Repository・UI・Core Domain はいずれも変更しない。
- `RecordStore` が id 単位の upsert で構成されているのは、この差分同期を
  後から足せるようにするため。
- **ローカルへの書き込みを先に確定させ、同期は後追いにする。**
  同期が失敗してもトレーニングが止まらないことを常に優先する。
- 同期が存在しない状態で全機能が動く、という Phase 2 の要件は今後も壊さない。

## 7. 耐久性の検証

`src/data/__tests__/durability.test.ts` が、Repository ごしの「アプリから見える状態」で
次の 4 つを確認する。ここが落ちる＝ユーザーの記録が消える、という位置づけ。

| シナリオ | 確認していること |
|---|---|
| アプリ更新 | 旧 version の DB を新しい migration 並びで開いても、Baseline / History / Recall / Settings が一致する |
| Backup 往復 | 書き出し → 初期化 → 取り込みで元の状態に戻る。別端末の空 DB へ移しても同じ |
| migration 失敗 | 途中で例外が出ても DB は旧 version のまま残り、記録が読める |
| 保存先の退避 | IndexedDB が無い環境でも一通りのトレーニングが記録でき、再起動後も残る。後から IndexedDB が使えるようになれば移送される |
