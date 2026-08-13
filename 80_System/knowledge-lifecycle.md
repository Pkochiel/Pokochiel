# Knowledge Lifecycle

```
Raw → Processed → Knowledge → Connected → Reusable
```

`status` は「そのノートがどこまで知識化されたか」を表す。
**遷移条件を満たさないまま status を上げてはならない。**
status の詐称は、Vault の状態を信用できなくする。

---

## `raw`

未処理。原文・断片・投げ込み。

- 置き場所: `00_Inbox/`, `05_Daily/`
- 満たすべき条件: なし（速度優先。整形しない）
- **滞留させないこと。** raw のまま2週間を超えたものは
  `/process-inbox` の優先処理対象、または捨てる候補

### → `processed` への遷移条件

- [ ] 内容が分類されている（どの領域の、どういう種類の情報か）
- [ ] 要約がある
- [ ] `source` が記録されている
- [ ] 適切なフォルダに置かれている

---

## `processed`

要約・分類済み。ただしまだ「再利用できる知識」ではない。

- 置き場所: 主に `40_Sources/`
- 原文と AI 要約が分離されている
- Atomic Note 候補が抽出されている

### → `knowledge` への遷移条件

- [ ] 1ノート1概念になっている
- [ ] `## Key Insight` が具体的で、一般論になっていない
- [ ] `## Implications`（だから何か）が書かれている
- [ ] 既存ノートと重複していない（検索で確認済み）
- [ ] `source` が保持されている

---

## `knowledge`

Atomic Note として成立している。単体で読んで意味が通る。

- 置き場所: `20_Knowledge/`, `30_Frameworks/`, `60_Decisions/`
- **ただしまだ孤立している可能性がある**

### → `connected` への遷移条件

- [ ] WikiLink が1本以上あり、**関連理由**が書かれている
- [ ] 被リンクがある、または MOC に登録されている
- [ ] 関連ノートからも相互に辿れる（双方向）

---

## `connected`

他の知識と接続され、Vault の構造に組み込まれている。
**ここまで来て初めて「Knowledge OS の一部」になる。**

### → `reusable` への遷移条件

- [ ] 実務で1回以上使った、または使える形まで具体化されている
- [ ] 内容が検証済み（`confidence: high`）
- [ ] 3ヶ月後の自分が読んで、そのまま使える

---

## `reusable`

実務でそのまま使える完成度。検証済み。

- Frameworks の多くはここを目指す
- 陳腐化しやすい領域（AI など）は `review_after` を設定し、期日で再確認する

---

## 逆方向の遷移

status は下がることもある。むしろ**下げる判断は健全である。**

| 状況 | 対応 |
| --- | --- |
| 前提が変わり内容が古くなった | `reusable` → `knowledge` に戻し、`review_after` を設定 |
| 検証したら誤りだった | 内容を訂正し `confidence: low` に。**削除はしない** |
| 完全に陳腐化した | `90_Archive/` へ移動を**提案**（人間の承認必須） |

**削除は最終手段であり、Claude Code は実行しない。** 移動を提案するに留める。

---

## Claude Code の関与範囲

| 遷移 | 主担当 |
| --- | --- |
| `raw` → `processed` | **Claude**（分類・要約・出典整理）→ 人間が確認 |
| `processed` → `knowledge` | **Claude が候補提示** → 人間が取捨選択 → Claude が生成 |
| `knowledge` → `connected` | **Claude**（リンク候補提示・MOC 更新）→ 人間が承認 |
| `connected` → `reusable` | **人間のみ。** 実務での検証は AI にはできない |

`reusable` への昇格を Claude が独断で行ってはならない。
