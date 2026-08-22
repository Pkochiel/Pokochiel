import { describe, expect, it } from 'vitest'
import {
  DIRECTION_PAIRS,
  KANJI_LINE,
  KANJI_NUMERALS,
  NUMBER_RANDOM,
  buildKanjiLineSheet,
  buildKanjiLineSheets,
  buildNumberRandomSheets,
  buildSpeedCheckSheet,
  speedCheckTargetFor,
} from './sheets'
import { buildSearchSheet, combineSearchResults, scoreSearch } from './visual-search'

const sheet = (seed = 'day') =>
  buildSearchSheet({
    id: 's',
    columns: 10,
    rows: 5,
    symbols: ['あ', 'い', 'う', 'え'],
    targetLabel: 'あ',
    targetRatio: 0.2,
    seed,
  })

describe('buildSearchSheet', () => {
  it('columns × rows のマスを作る', () => {
    expect(sheet().cells).toHaveLength(50)
  })

  it('index が 0 から連番になる', () => {
    expect(sheet().cells.map((cell) => cell.index)).toEqual([...Array(50).keys()])
  })

  it('指定した割合の対象を置く', () => {
    // 完全一致は求めない。引き直しで重なるぶん少なくなることがある。
    const built = sheet()
    expect(built.targetCount).toBeGreaterThan(5)
    expect(built.targetCount).toBeLessThanOrEqual(10)
  })

  it('targetCount と盤面上の対象の数が一致する', () => {
    const built = sheet()
    expect(built.cells.filter((cell) => cell.target)).toHaveLength(built.targetCount)
  })

  it('対象でないマスに対象と同じ文字を置かない', () => {
    // 見た目が対象なのに拾えないマスがあると、課題として破綻する。
    const built = sheet()
    for (const cell of built.cells) {
      if (!cell.target) expect(cell.label).not.toBe(built.targetLabel)
    }
  })

  it('同じ種なら同じ盤面になる', () => {
    expect(sheet('x').cells).toEqual(sheet('x').cells)
  })

  it('種が変われば盤面が変わる', () => {
    expect(sheet('x').cells).not.toEqual(sheet('y').cells)
  })

  it('対象が一箇所に固まらない', () => {
    // 固まっていると一度見つけたあとが作業になり、盤面を走査する訓練にならない。
    const built = sheet()
    const rowsWithTarget = new Set(
      built.cells.filter((cell) => cell.target).map((cell) => Math.floor(cell.index / 10)),
    )
    expect(rowsWithTarget.size).toBeGreaterThan(1)
  })

  it('マスが 0 なら空の盤面を返す', () => {
    const empty = buildSearchSheet({
      id: 'e',
      columns: 0,
      rows: 0,
      symbols: ['あ'],
      targetLabel: 'あ',
      targetRatio: 0.2,
      seed: 's',
    })
    expect(empty.cells).toEqual([])
    expect(empty.targetCount).toBe(0)
  })

  it('対象しか記号がなくても落ちない', () => {
    const only = buildSearchSheet({
      id: 'o',
      columns: 3,
      rows: 3,
      symbols: ['あ'],
      targetLabel: 'あ',
      targetRatio: 0.5,
      seed: 's',
    })
    expect(only.cells).toHaveLength(9)
  })
})

describe('scoreSearch', () => {
  const targets = () => sheet().cells.filter((cell) => cell.target).map((cell) => cell.index)
  const others = () => sheet().cells.filter((cell) => !cell.target).map((cell) => cell.index)

  it('拾えた対象の数を数える', () => {
    const picked = targets().slice(0, 3)
    expect(scoreSearch(sheet(), picked).found).toBe(3)
  })

  it('拾い損ねた数を出す', () => {
    const built = sheet()
    const result = scoreSearch(built, targets().slice(0, 2))
    expect(result.missed).toBe(built.targetCount - 2)
  })

  it('対象でないマスを拾ったら wrong になる', () => {
    expect(scoreSearch(sheet(), others().slice(0, 4)).wrong).toBe(4)
  })

  it('同じマスを何度拾っても1回として数える', () => {
    const first = targets()[0]!
    expect(scoreSearch(sheet(), [first, first, first, first]).found).toBe(1)
  })

  it('盤面にない位置を拾っても数えない', () => {
    const result = scoreSearch(sheet(), [999, -1])
    expect(result.found).toBe(0)
    expect(result.wrong).toBe(0)
  })

  it('速いが当てずっぽうを precision で見分ける', () => {
    const all = sheet().cells.map((cell) => cell.index)
    // 全マスを拾えば対象は全部取れるが、正確さは低い。
    const result = scoreSearch(sheet(), all)
    expect(result.found).toBe(sheet().targetCount)
    expect(result.precision).toBeLessThan(30)
  })

  it('一つも拾わなければ precision は 0', () => {
    expect(scoreSearch(sheet(), []).precision).toBe(0)
  })
})

describe('combineSearchResults', () => {
  it('各回のスコアを並びとして残す', () => {
    // 記録は「22・20・18・24」の形で残したい。
    const results = [
      { found: 22, missed: 1, wrong: 0, total: 23, precision: 100 },
      { found: 20, missed: 3, wrong: 1, total: 23, precision: 95 },
    ]
    expect(combineSearchResults(results).attempts).toEqual([22, 20])
  })

  it('合計を出す', () => {
    const results = [
      { found: 5, missed: 1, wrong: 2, total: 6, precision: 71 },
      { found: 3, missed: 3, wrong: 0, total: 6, precision: 100 },
    ]
    const combined = combineSearchResults(results)
    expect(combined.found).toBe(8)
    expect(combined.missed).toBe(4)
    expect(combined.wrong).toBe(2)
    expect(combined.total).toBe(12)
  })

  it('空でも落ちない', () => {
    expect(combineSearchResults([])).toEqual({
      attempts: [],
      found: 0,
      missed: 0,
      wrong: 0,
      total: 0,
      precision: 0,
    })
  })
})

describe('漢数字一行の盤面', () => {
  it('横30・縦3で作る', () => {
    const built = buildKanjiLineSheet('day', '一')
    expect(built.columns).toBe(30)
    expect(built.rows).toBe(3)
    expect(built.cells).toHaveLength(90)
  })

  it('一〜十の漢数字だけで埋める', () => {
    const labels = new Set(buildKanjiLineSheet('day', '一').cells.map((cell) => cell.label))
    for (const label of labels) expect(KANJI_NUMERALS).toContain(label)
  })

  it('一・二・三の3ターンぶんを作る', () => {
    const sheets = buildKanjiLineSheets('day')
    expect(sheets.map((s) => s.targetLabel)).toEqual([...KANJI_LINE.targets])
  })

  it('ターンごとに盤面が変わる', () => {
    const [first, second] = buildKanjiLineSheets('day')
    expect(first?.cells.map((c) => c.label)).not.toEqual(second?.cells.map((c) => c.label))
  })

  it('90秒で拾い切れる量に収める', () => {
    for (const built of buildKanjiLineSheets('day')) {
      expect(built.targetCount).toBeGreaterThan(4)
      expect(built.targetCount).toBeLessThan(20)
    }
  })
})

describe('スピードチェックの盤面', () => {
  it('方角漢字の2文字の組み合わせで埋める', () => {
    const built = buildSpeedCheckSheet('day', '東西')
    for (const cell of built.cells) {
      expect(DIRECTION_PAIRS).toContain(cell.label)
      expect(cell.label).toHaveLength(2)
    }
  })

  it('同じ字を重ねた組み合わせは作らない', () => {
    for (const pair of DIRECTION_PAIRS) expect(pair[0]).not.toBe(pair[1])
  })

  it('東西と西東を別の組み合わせとして扱う', () => {
    expect(DIRECTION_PAIRS).toContain('東西')
    expect(DIRECTION_PAIRS).toContain('西東')
  })

  it('12通りある', () => {
    expect(new Set(DIRECTION_PAIRS).size).toBe(12)
  })

  it('探す組み合わせは日ごとに変わる', () => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
    expect(new Set(days.map(speedCheckTargetFor)).size).toBeGreaterThan(3)
  })

  it('探す組み合わせは必ず候補のひとつ', () => {
    expect(DIRECTION_PAIRS).toContain(speedCheckTargetFor('2026-09-01'))
  })
})

describe('数字ランダムの盤面', () => {
  it('4枚のシートを作る', () => {
    expect(buildNumberRandomSheets('day')).toHaveLength(NUMBER_RANDOM.sheets)
  })

  it('1 から最大値までを重複なく並べる', () => {
    for (const built of buildNumberRandomSheets('day')) {
      expect([...built.numbers].sort((a, b) => a - b)).toEqual(
        Array.from({ length: built.max }, (_, i) => i + 1),
      )
    }
  })

  it('シートごとに並びが違う', () => {
    const sheets = buildNumberRandomSheets('day')
    expect(sheets[0]?.numbers).not.toEqual(sheets[1]?.numbers)
  })

  it('同じ種なら同じ並びになる', () => {
    expect(buildNumberRandomSheets('day')[0]?.numbers).toEqual(
      buildNumberRandomSheets('day')[0]?.numbers,
    )
  })

  it('日が変われば並びが変わる', () => {
    expect(buildNumberRandomSheets('day-a')[0]?.numbers).not.toEqual(
      buildNumberRandomSheets('day-b')[0]?.numbers,
    )
  })
})
