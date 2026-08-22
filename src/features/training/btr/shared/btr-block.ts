/**
 * BTR の種目に共通する受け渡し。
 *
 * 一覧（btr-catalog）は各ブロックを import するので、型をそこに置くと
 * ブロック側から参照したときに輪になる。型だけを別に出しておく。
 */

/**
 * 種目が返す成績。
 *
 * docs/BTR_METHOD.md §5 の記録の型に合わせている。主スコアだけを返すと、
 * 「30問中26問正解」と「10問中10問正解」が同じ26として残ってしまい、
 * あとから見て意味が取れない。質を表す数字も一緒に返す。
 */
export interface BtrOutcome {
  /** 主スコア（到達数・正答数・往復数など） */
  readonly score: number
  /** サッケイドのたて／よこのような、同じ種目の中の区別 */
  readonly variant?: string
  /** 複数試行する種目の各試行スコア。数字ランダムの4枚など。 */
  readonly attempts?: readonly number[]
  /** かかった時間（ms） */
  readonly elapsedMs?: number
  /** そのとき課された制限時間（ms）。級に相当する。 */
  readonly timeLimitMs?: number
  /** 見落とし率・正答率など、質を表す副指標（0–100） */
  readonly accuracy?: number
  /** カウント呼吸法のように小さいほうがよい種目だけ true */
  readonly lowerIsBetter?: boolean
  /** 分速（字/分）。読書だけが持つ。 */
  readonly cpm?: number
  /** 計測として有効か。既定は true。 */
  readonly valid?: boolean
}

export interface BtrBlockProps {
  /** その回の課題を決める種。日付を渡す。 */
  readonly seed: string
  /** 級（0 始まり） */
  readonly level?: number
  readonly onComplete: (outcome: BtrOutcome) => void
}
