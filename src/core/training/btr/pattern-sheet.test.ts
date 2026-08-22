import { describe, expect, it } from 'vitest'
import {
  KANJI_DIGITS,
  PATTERN_SHEET,
  buildPatternSheet,
  buildPatternSheets,
  isMarkedColumn,
  scorePatternSheet,
  type PatternPick,
} from './pattern-sheet'

const sheet = (seed = 'day', targetLabel = '一') => buildPatternSheet({ seed, targetLabel })

describe('KANJI_DIGITS', () => {
  it('〇を含む10種になっている', () => {
    // 実物のシートには 〇 が頻出する。一〜十ではなく 0〜9 にあたる10文字。
    expect(KANJI_DIGITS).toHaveLength(10)
    expect(KANJI_DIGITS).toContain('〇')
  })

  it('十を含まない', () => {
    expect(KANJI_DIGITS).not.toContain('十')
  })
})

describe('buildPatternSheet', () => {
  it('列を80本作る', () => {
    expect(sheet().columns).toHaveLength(PATTERN_SHEET.columnCount)
  })

  it('列番号が1から連番になる', () => {
    // 実物のシートと同じ数え方にする。
    expect(sheet().columns.map((column) => column.number)).toEqual(
      Array.from({ length: PATTERN_SHEET.columnCount }, (_, i) => i + 1),
    )
  })

  it('1列に決まった字数を並べる', () => {
    for (const column of sheet().columns) {
      expect(column.cells).toHaveLength(PATTERN_SHEET.charsPerColumn)
    }
  })

  it('上下2段に折り返す', () => {
    const bands = new Set(sheet().columns.map((column) => column.band))
    expect(bands.size).toBe(PATTERN_SHEET.bands)
  })

  it('前半が上段、後半が下段になる', () => {
    const columns = sheet().columns
    expect(columns[0]?.band).toBe(0)
    expect(columns.at(-1)?.band).toBe(1)
  })

  it('漢数字の桁だけで埋める', () => {
    for (const column of sheet().columns) {
      for (const cell of column.cells) expect(KANJI_DIGITS).toContain(cell.label)
    }
  })

  it('対象の印が字と一致する', () => {
    const built = sheet()
    for (const column of built.columns) {
      for (const cell of column.cells) {
        expect(cell.target).toBe(cell.label === built.targetLabel)
      }
    }
  })

  it('targetCount と対象の数が一致する', () => {
    const built = sheet()
    const counted = built.columns.reduce(
      (sum, column) => sum + column.cells.filter((cell) => cell.target).length,
      0,
    )
    expect(built.targetCount).toBe(counted)
  })

  it('列ごとの対象数も数えている', () => {
    for (const column of sheet().columns) {
      expect(column.targetCount).toBe(column.cells.filter((cell) => cell.target).length)
    }
  })

  it('10種が一様に出る', () => {
    // 対象だけを多めに置かない。何個あるか分からないまま探すのがこの課題の前提。
    const built = sheet()
    const all = built.columns.flatMap((column) => column.cells)
    const targets = all.filter((cell) => cell.target).length
    const expected = all.length / KANJI_DIGITS.length
    expect(targets).toBeGreaterThan(expected * 0.7)
    expect(targets).toBeLessThan(expected * 1.3)
  })

  it('ターンごとに3枚作る', () => {
    const sheets = buildPatternSheets('day')
    expect(sheets.map((s) => s.targetLabel)).toEqual([...PATTERN_SHEET.targets])
  })

  it('同じ種なら同じシートになる', () => {
    expect(sheet('x')).toEqual(sheet('x'))
  })

  it('種が変わればシートが変わる', () => {
    expect(sheet('x').columns).not.toEqual(sheet('y').columns)
  })

  it('列や字数が 0 以下なら空を返す', () => {
    expect(buildPatternSheet({ seed: 'd', targetLabel: '一', columnCount: 0 }).columns).toEqual([])
    expect(
      buildPatternSheet({ seed: 'd', targetLabel: '一', charsPerColumn: 0 }).columns,
    ).toEqual([])
  })
})

describe('isMarkedColumn', () => {
  it('5刻みで番号を振る', () => {
    expect(isMarkedColumn(5)).toBe(true)
    expect(isMarkedColumn(80)).toBe(true)
    expect(isMarkedColumn(1)).toBe(false)
    expect(isMarkedColumn(7)).toBe(false)
  })
})

describe('scorePatternSheet', () => {
  const targetPicks = (count: number): PatternPick[] => {
    const built = sheet()
    const picks: PatternPick[] = []
    for (const column of built.columns) {
      for (const cell of column.cells) {
        if (cell.target && picks.length < count) {
          picks.push({ column: column.number, row: cell.row })
        }
      }
    }
    return picks
  }

  it('拾えた対象を数える', () => {
    expect(scorePatternSheet(sheet(), targetPicks(6)).found).toBe(6)
  })

  it('拾い損ねた数を出す', () => {
    const built = sheet()
    expect(scorePatternSheet(built, targetPicks(4)).missed).toBe(built.targetCount - 4)
  })

  it('対象でないマスを拾ったら wrong になる', () => {
    const built = sheet()
    const wrong = built.columns
      .flatMap((column) => column.cells.map((cell) => ({ column, cell })))
      .filter(({ cell }) => !cell.target)
      .slice(0, 3)
      .map(({ column, cell }) => ({ column: column.number, row: cell.row }))
    expect(scorePatternSheet(built, wrong).wrong).toBe(3)
  })

  it('同じマスを何度拾っても1回として数える', () => {
    const pick = targetPicks(1)[0]!
    expect(scorePatternSheet(sheet(), [pick, pick, pick]).found).toBe(1)
  })

  it('どこまで進んだかを列番号で出す', () => {
    // 実物のシートに5刻みの番号があるのは、到達した列を読み取るためと考えられる。
    const picks = targetPicks(10)
    const expected = Math.max(...picks.map((pick) => pick.column))
    expect(scorePatternSheet(sheet(), picks).reachedColumn).toBe(expected)
  })

  it('ないマスを指しても数えない', () => {
    const result = scorePatternSheet(sheet(), [{ column: 999, row: 0 }, { column: 1, row: 99 }])
    expect(result.found).toBe(0)
    expect(result.wrong).toBe(0)
  })

  it('一つも拾わなければ 0 を返す', () => {
    const result = scorePatternSheet(sheet(), [])
    expect(result.found).toBe(0)
    expect(result.reachedColumn).toBe(0)
    expect(result.precision).toBe(0)
  })
})
