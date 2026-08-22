import { describe, expect, it } from 'vitest'
import {
  KANA_PICKUP,
  buildKanaSheet,
  isKanaTarget,
  judgeKanaPickup,
  readingFront,
  scoreKanaPickup,
  type KanaPickupResult,
} from './kana-pickup'

const LINES = ['あかいとり', 'がとんだ', 'おおきなうみ'] as const

describe('isKanaTarget', () => {
  it('あいうえお だけを対象にする', () => {
    for (const char of KANA_PICKUP.targets) expect(isKanaTarget(char)).toBe(true)
  })

  it('読みが同じでも漢字やカタカナは対象にしない', () => {
    // 拾うのは字であって音ではない。「青」を対象にすると読みの知識を測ってしまう。
    for (const char of ['青', 'ア', 'か', 'ぁ', 'ー']) expect(isKanaTarget(char)).toBe(false)
  })
})

describe('buildKanaSheet', () => {
  it('全文字を通し番号で持つ', () => {
    const sheet = buildKanaSheet(LINES)
    expect(sheet.chars).toHaveLength(5 + 4 + 6)
    expect(sheet.chars.map((char) => char.index)).toEqual(
      sheet.chars.map((_, index) => index),
    )
  })

  it('行の区切りを保つ', () => {
    const sheet = buildKanaSheet(LINES)
    expect(sheet.lines).toHaveLength(3)
    expect(sheet.lines[1]!.chars.map((char) => char.char).join('')).toBe('がとんだ')
    expect(sheet.lines[2]!.chars.every((char) => char.line === 2)).toBe(true)
  })

  it('対象の数を数える', () => {
    // あかいとり: あ い / がとんだ: なし / おおきなうみ: お お う
    expect(buildKanaSheet(LINES).targetCount).toBe(5)
  })

  it('対象でない字も持つ', () => {
    // 拾い間違いを数えるために全文字が要る。
    const sheet = buildKanaSheet(['かき'])
    expect(sheet.chars).toHaveLength(2)
    expect(sheet.chars.every((char) => !char.target)).toBe(true)
  })

  it('空行があっても番号がずれない', () => {
    const sheet = buildKanaSheet(['あい', '', 'うえ'])
    expect(sheet.lines[1]!.chars).toEqual([])
    expect(sheet.chars.map((char) => char.char).join('')).toBe('あいうえ')
    expect(sheet.chars[2]!.line).toBe(2)
  })

  it('本文がなければ空になる', () => {
    const sheet = buildKanaSheet([])
    expect(sheet.chars).toEqual([])
    expect(sheet.targetCount).toBe(0)
  })
})

describe('readingFront', () => {
  it('押した中でいちばん後ろを先端とする', () => {
    const sheet = buildKanaSheet(LINES)
    expect(readingFront(sheet, [0, 9, 2])).toEqual({ charIndex: 9, line: 2 })
  })

  it('何も押していなければ先端がない', () => {
    expect(readingFront(buildKanaSheet(LINES), [])).toEqual({ charIndex: -1, line: -1 })
  })

  it('本文にない番号は無視する', () => {
    const sheet = buildKanaSheet(LINES)
    expect(readingFront(sheet, [1, 999])).toEqual({ charIndex: 1, line: 0 })
  })
})

describe('scoreKanaPickup', () => {
  const sheet = buildKanaSheet(LINES)

  it('拾えた数を数える', () => {
    // 0:あ 2:い
    const result = scoreKanaPickup(sheet, [0, 2])
    expect(result.found).toBe(2)
    expect(result.score).toBe(2)
    expect(result.wrong).toBe(0)
  })

  it('対象でない字を押したら拾い間違いになる', () => {
    // 1:か
    const result = scoreKanaPickup(sheet, [0, 1])
    expect(result.found).toBe(1)
    expect(result.wrong).toBe(1)
  })

  it('同じ字を二度押しても1回として数える', () => {
    expect(scoreKanaPickup(sheet, [0, 0, 0]).found).toBe(1)
  })

  it('まだ読んでいない先を見落としに数えない', () => {
    // 先端は 2:い。そこまでの対象は あ・い の2つだけ。
    const result = scoreKanaPickup(sheet, [0, 2])
    expect(result.reachedTargets).toBe(2)
    expect(result.missed).toBe(0)
    expect(result.foundRatio).toBe(100)
    // 本文全体では5つある。
    expect(result.totalTargets).toBe(5)
  })

  it('読んだ範囲の見落としは数える', () => {
    // 先端は 9:お。そこまでの対象は あ・い・お の3つ。拾ったのは お だけ。
    const result = scoreKanaPickup(sheet, [9])
    expect(result.reachedTargets).toBe(3)
    expect(result.found).toBe(1)
    expect(result.missed).toBe(2)
    expect(result.foundRatio).toBe(33)
  })

  it('読み進めた行を返す', () => {
    expect(scoreKanaPickup(sheet, [9]).reachedLine).toBe(2)
    expect(scoreKanaPickup(sheet, []).reachedLine).toBe(-1)
    expect(scoreKanaPickup(sheet, []).totalLines).toBe(3)
  })

  it('何も押さなければ拾い率は0になる', () => {
    const result = scoreKanaPickup(sheet, [])
    expect(result.found).toBe(0)
    expect(result.reachedTargets).toBe(0)
    expect(result.foundRatio).toBe(0)
  })

  it('内容確認を渡せば正答率を出す', () => {
    const result = scoreKanaPickup(sheet, [0], { asked: 4, correct: 3 })
    expect(result.comprehension).toEqual({ asked: 4, correct: 3, ratio: 75 })
  })

  it('内容確認がなければ null になる', () => {
    expect(scoreKanaPickup(sheet, [0]).comprehension).toBeNull()
    // 読んだ範囲に問える箇所がなく0問だった回も同じ扱いにする。
    expect(scoreKanaPickup(sheet, [0], { asked: 0, correct: 0 }).comprehension).toBeNull()
  })
})

describe('judgeKanaPickup', () => {
  const base: KanaPickupResult = {
    score: 0,
    found: 0,
    missed: 0,
    wrong: 0,
    reachedTargets: 20,
    totalTargets: 40,
    reachedLine: 5,
    totalLines: 12,
    foundRatio: 95,
    comprehension: { asked: 4, correct: 4, ratio: 100 },
  }

  it('拾い率と内容正答がそろえば上がる', () => {
    expect(judgeKanaPickup(base)).toBe('advance')
  })

  it('拾えていても内容が取れていなければ上がらない', () => {
    // 字面を走らせて数だけ出した回。この種目の意味がなくなるので据え置く。
    expect(
      judgeKanaPickup({ ...base, comprehension: { asked: 4, correct: 1, ratio: 25 } }),
    ).toBe('stay')
  })

  it('内容確認が出せなかった回は上げない', () => {
    expect(judgeKanaPickup({ ...base, comprehension: null })).toBe('stay')
  })

  it('拾い率が低ければ下がる', () => {
    expect(judgeKanaPickup({ ...base, foundRatio: 40 })).toBe('fallback')
  })

  it('中間は据え置き', () => {
    expect(judgeKanaPickup({ ...base, foundRatio: 75 })).toBe('stay')
  })

  it('一つも読めていない回は下げない', () => {
    // 押す前に時間切れになった回まで降級させると、事故で級が落ちる。
    expect(judgeKanaPickup({ ...base, reachedTargets: 0, foundRatio: 0 })).toBe('stay')
  })
})
