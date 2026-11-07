import { createRandom, hashString } from '../../util/seeded-shuffle'

/**
 * スピードボード（BTRメソッド 読書内容への集中）
 *
 * 5×5 の盤。真ん中の点からどう動くかの指示が書いてあり、
 * その指示どおりに動いた先のマスをどれだけ速く指せるかを見る。正解数で級を判定する。
 *
 * 盤の上で指を滑らせて数えるのではなく、頭の中で位置を動かすのがこの種目の要点である。
 * 指示は「右に2、上に1」のように複数の手を含み、級が上がるほど手数が増える。
 */

export const SPEED_BOARD = {
  /** 盤の一辺。5×5。 */
  size: 5,
  /** 1回の出題数 */
  questionCount: 30,
  /**
   * 級ごとの手数。上がるほど頭の中で保つ手数が増える。
   * 級は 0 始まりで、この配列の添字に対応する。
   */
  stepsByLevel: [1, 2, 3, 4],
  /** 制限時間の段階（ms） */
  timeLimits: [240_000, 180_000, 150_000, 120_000, 90_000],
  /** 次の段へ上がる正答率（%） */
  advanceAccuracy: 90,
  /** ひとつ前の段へ戻る正答率（%） */
  fallbackAccuracy: 70,
} as const

export type BoardDirection = 'up' | 'down' | 'left' | 'right'

export const BOARD_DIRECTION_LABELS: Record<BoardDirection, string> = {
  up: '上',
  down: '下',
  left: '左',
  right: '右',
}

export interface BoardStep {
  readonly direction: BoardDirection
  readonly distance: number
}

export interface BoardQuestion {
  readonly id: string
  /** 真ん中からの動き。上から順に適用する。 */
  readonly steps: readonly BoardStep[]
  /** 動いた先のマス（行優先の添字） */
  readonly answerIndex: number
}

/** 盤の真ん中のマス。5×5 なら 12。 */
export function centerIndex(size: number = SPEED_BOARD.size): number {
  const middle = Math.floor(size / 2)
  return middle * size + middle
}

interface Position {
  readonly column: number
  readonly row: number
}

function move(position: Position, step: BoardStep): Position {
  switch (step.direction) {
    case 'up':
      return { column: position.column, row: position.row - step.distance }
    case 'down':
      return { column: position.column, row: position.row + step.distance }
    case 'left':
      return { column: position.column - step.distance, row: position.row }
    case 'right':
      return { column: position.column + step.distance, row: position.row }
  }
}

function inside(position: Position, size: number): boolean {
  return (
    position.column >= 0 && position.column < size && position.row >= 0 && position.row < size
  )
}

/** 指示どおりに動いた先。盤の外へ出る指示は作らないので、必ず盤内に収まる。 */
export function applySteps(
  steps: readonly BoardStep[],
  size: number = SPEED_BOARD.size,
): number {
  const middle = Math.floor(size / 2)
  let position: Position = { column: middle, row: middle }
  for (const step of steps) position = move(position, step)
  return position.row * size + position.column
}

const DIRECTIONS: readonly BoardDirection[] = ['up', 'down', 'left', 'right']

/**
 * 1問作る。
 *
 * 盤の外へ出る指示は作らない。「盤の外だから答えられない」は
 * この種目が測りたいものではないため。
 * 同じ向きを続けない（「右に1、右に1」は「右に2」と同じで手数が水増しになる）。
 */
function buildQuestion(id: string, stepCount: number, size: number, random: () => number): BoardQuestion {
  const middle = Math.floor(size / 2)
  let position: Position = { column: middle, row: middle }
  const steps: BoardStep[] = []
  let lastDirection: BoardDirection | null = null

  for (let i = 0; i < stepCount; i += 1) {
    // その場から動ける向きと距離をすべて挙げ、そこから選ぶ。
    const candidates: BoardStep[] = []
    for (const direction of DIRECTIONS) {
      if (direction === lastDirection) continue
      for (let distance = 1; distance < size; distance += 1) {
        const step = { direction, distance }
        if (inside(move(position, step), size)) candidates.push(step)
      }
    }
    if (candidates.length === 0) break

    const step = candidates[Math.floor(random() * candidates.length)]
    if (!step) break
    steps.push(step)
    position = move(position, step)
    lastDirection = step.direction
  }

  return { id, steps, answerIndex: position.row * size + position.column }
}

export interface BuildSpeedBoardInput {
  readonly seed: string
  /** 級（0 始まり）。手数がこれで決まる。 */
  readonly level?: number
  readonly count?: number
  readonly size?: number
}

export function buildSpeedBoardQuestions(input: BuildSpeedBoardInput): BoardQuestion[] {
  const {
    seed,
    level = 0,
    count = SPEED_BOARD.questionCount,
    size = SPEED_BOARD.size,
  } = input
  if (count <= 0 || size <= 0) return []

  const steps =
    SPEED_BOARD.stepsByLevel[Math.min(level, SPEED_BOARD.stepsByLevel.length - 1)] ??
    SPEED_BOARD.stepsByLevel[0] ??
    1
  const random = createRandom(hashString(`${seed}:speed-board:${level}`))

  return Array.from({ length: count }, (_, index) =>
    buildQuestion(`sb-${index + 1}`, steps, size, random),
  )
}

export interface SpeedBoardResult {
  readonly correct: number
  readonly wrong: number
  readonly unanswered: number
  readonly total: number
  /** 正答率（0–100）。分母は出題数。 */
  readonly accuracy: number
}

export function scoreSpeedBoard(
  questions: readonly BoardQuestion[],
  answers: ReadonlyMap<string, number>,
): SpeedBoardResult {
  let correct = 0
  let wrong = 0

  for (const question of questions) {
    const answer = answers.get(question.id)
    if (answer === undefined) continue
    if (answer === question.answerIndex) correct += 1
    else wrong += 1
  }

  const total = questions.length
  return {
    correct,
    wrong,
    unanswered: total - correct - wrong,
    total,
    accuracy: total === 0 ? 0 : Math.round((correct / total) * 100),
  }
}
