# Speed Reading Lab — Release

新しい版を配ったときに、**既存ユーザーの学習データと動作中の PWA を壊さない**ための
手順と、その保証を誰が持っているかをまとめる。

## 1. CI

`.github/workflows/ci.yml`

| きっかけ | 走るジョブ |
|---|---|
| Pull Request | `verify` → `E2E (smoke)` |
| 開発ブランチへの push | `verify` → `E2E (smoke)` |
| `main` / `master` への push | `verify` → `E2E (full)` |
| 手動実行（workflow_dispatch） | `full_e2e` の指定で smoke / full を選ぶ |

### verify

```
npm ci → typecheck → lint → unit test → production build
```

1,100 件超のユニットテストが Regression の主検出器。ここが落ちたら E2E は走らせない
（`needs: verify`）。所要は概ね 1 分。

### E2E の分け方

| | 対象 | 目安 |
|---|---|---|
| smoke | `smoke` / `offline` / `pwa-update` / `progress` | 30 秒程度 |
| full | 上記＋ `baseline`（実時間の読書を伴う）＋ `phase15-flow`（1 セッション完走） | 5 分程度 |

Baseline の E2E は**計測の妥当性判定を迂回しない**（教材を実際に読む時間だけ滞在する）ため
時間がかかる。PR ごとに回すには重いので、統合時にだけ回す。

Playwright のブラウザは `package-lock.json` のハッシュでキャッシュする。
失敗時のみ `playwright-report` を artifact に残す（7 日）。

### ローカルで同じものを回す

```bash
npm run check      # typecheck + lint + unit
npm run e2e:smoke  # CI の PR 相当
npm run e2e:full   # CI の統合相当
```

## 2. Build

```bash
npm run build      # next build
```

- `next.config.ts` が `package.json` の version を読み、
  `NEXT_PUBLIC_APP_VERSION` と `NEXT_PUBLIC_BUILD_ID` を埋め込む。
- `BUILD_ID` 環境変数を渡すとビルド ID を固定できる（未指定ならビルド時刻から生成）。
- トレーニング画面は `generateStaticParams` で静的出力する。オフラインで開けるため。

| 埋め込む値 | 使い道 |
|---|---|
| `NEXT_PUBLIC_APP_VERSION` | Backup ファイルの `appVersion` |
| `NEXT_PUBLIC_BUILD_ID` | Service Worker のキャッシュ名 |

## 3. PWA のキャッシュ更新

Service Worker は `/sw.js?build=<BUILD_ID>` として登録する。

```
新しいビルドを配る
   ↓ HTML はネットワーク優先なので、オンラインなら新しい HTML を受け取る
   ↓ 新しい HTML は新しいハッシュの JS を指す → 取得 → BUILD_ID が変わる
   ↓ 登録 URL が変わる → install（precache）→ activate
   ↓ activate で **このビルド以外の srl- キャッシュをすべて削除**
新しい版で起動する
```

- 古い JS / CSS が無期限に残ることはない。削除対象は `srl-` 接頭辞のものだけで、
  同一オリジンの他のキャッシュには触らない。
- **HTML と JS の不整合を防ぐ 2 点**
  1. HTML はネットワーク優先（オンラインなら常に最新を見る）
  2. HTML をキャッシュに入れるとき、その HTML が参照する JS / CSS も併せて取り込む
  ファイル名にハッシュが入るため、新しい HTML が古いチャンクを指すことはない。
- `skipWaiting()` + `clients.claim()` で即座に切り替える。
  トレーニング中の予期しないリロードは行わない（記録を失わせないため）。
- 開発時（`npm run dev`）は登録しない。キャッシュが変更の確認を妨げるため。

検証は `e2e/pwa-update.spec.ts`（smoke に含む）。
旧ビルド → 新ビルド → 旧キャッシュが消えている → オフラインでも起動できる、を確認する。

### キャッシュ戦略の変更が必要になったら

`public/sw.js` の `CACHE_PREFIX` を変えると、それ以前のキャッシュは
「他人のキャッシュ」として削除対象から外れ、residue になる。
接頭辞は変えず、必要なら `SHELL_ROUTES` と各ハンドラだけを変える。

## 4. スキーマの変更

### IndexedDB

詳細は docs/PERSISTENCE.md §3。要点だけ。

1. `SCHEMA_MIGRATIONS` の**末尾に**追記する（既存要素は書き換えない）
2. `DATABASE_VERSION` は自動で上がる
3. migration のテストと `durability.test.ts` のアプリ更新シナリオを通す
4. 失敗時は versionchange を abort し、DB は旧 version のまま残る

**DB を削除して作り直す方式は通常経路では使わない。**

### Backup

1. 形が変わったら `BACKUP_SCHEMA_VERSION` を上げる
2. `BACKUP_MIGRATIONS` に「旧 → 新」の変換を**追記する**
3. 旧 version のファイルを取り込むテストを足す

旧 backup を読めることは永続的な責務。ユーザーが持っているファイルは
後から書き換えられない。

### 互換性の一覧

| | 現行 | 読める範囲 |
|---|---|---|
| IndexedDB | version 1 | version 0（新規）以降すべて |
| Backup | schemaVersion 2 | schemaVersion 1, 2 |
| localStorage | `srl:v1:*` | 初回起動時に IndexedDB へ移送 |

## 5. リリース前のチェックリスト

- [ ] `npm run check` が通る
- [ ] `npm run e2e:full` が通る
- [ ] スキーマを変えたなら migration を**追記**した（既存要素の書き換えではない）
- [ ] Backup の形を変えたなら `BACKUP_SCHEMA_VERSION` を上げ、旧版の取り込みテストを足した
- [ ] `package.json` の version を上げた（Backup の `appVersion` に載る）
- [ ] docs/DATA_MODEL.md と docs/PERSISTENCE.md の該当箇所を更新した

## 6. 意図的にやらないこと

| | 理由 |
|---|---|
| 更新検知時の自動リロード | トレーニング中に画面が飛ぶと記録と集中の両方を失う |
| 起動時のリモート設定取得 | オフラインで起動できなくなる |
| DB の作り直しによるスキーマ変更 | 学習履歴が消える。migration で解決する |
| 壊れた Backup の推測による復元 | 黙って壊れたデータが入る。拒否して既存データを残す |
