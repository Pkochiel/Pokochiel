import { describe, expect, it } from 'vitest'
import { BP_SHEET, BP_SYMBOLS, buildBpSheet, scoreBpSheet } from './bp-sheet'

const sheet = (level = 0, seed = 'day') => buildBpSheet({ seed, level })

describe('buildBpSheet', () => {
  it('設定どおりの数を流す', () => {
    expect(sheet().items).toHaveLength(BP_SHEET.itemCount)
  })

  it('文字は決まった一覧から選ぶ', () => {
    for (const item of sheet().items) expect(BP_SYMBOLS).toContain(item.label)
  })

  it('対象は対象の文字、それ以外は別の文字になる', () => {
    const built = sheet()
    for (const item of built.items) {
      if (item.target) expect(item.label).toBe(built.targetLabel)
      else expect(item.label).not.toBe(built.targetLabel)
    }
  })

  it('targetCount と対象の数が一致する', () => {
    const built = sheet()
    expect(built.items.filter((item) => item.target)).toHaveLength(built.targetCount)
  })

  it('対象が少なすぎず多すぎない', () => {
    const built = sheet()
    expect(built.targetCount).toBeGreaterThan(5)
    expect(built.targetCount).toBeLessThan(BP_SHEET.itemCount * 0.5)
  })

  it('現れる時刻が順に並ぶ', () => {
    const items = sheet().items
    for (let i = 1; i < items.length; i += 1) {
      expect(items[i]!.appearsAtMs).toBeGreaterThan(items[i - 1]!.appearsAtMs)
    }
  })

  it('滞留時間ぶん表示されてから消える', () => {
    const built = sheet()
    for (const item of built.items) {
      expect(item.disappearsAtMs - item.appearsAtMs).toBe(built.lifetimeMs)
    }
  })

  it('同時に複数が出ている', () => {
    // 1つずつ出て消えるだけでは「動きの中で判別する」課題にならない。
    const built = sheet()
    const at = built.items[10]!.appearsAtMs
    const visible = built.items.filter(
      (item) => item.appearsAtMs <= at && item.disappearsAtMs > at,
    )
    expect(visible.length).toBeGreaterThan(1)
  })

  it('級が上がると滞留時間が短くなる', () => {
    expect(sheet(1).lifetimeMs).toBeLessThan(sheet(0).lifetimeMs)
    expect(sheet(2).lifetimeMs).toBeLessThan(sheet(1).lifetimeMs)
  })

  it('位置がばらける', () => {
    // 同じところに出続けると視線が固定され、動きの中で判別する課題にならない。
    const xs = new Set(sheet().items.map((item) => item.x.toFixed(3)))
    expect(xs.size).toBeGreaterThan(BP_SHEET.itemCount * 0.8)
  })

  it('位置が画面の中に収まる', () => {
    for (const item of sheet().items) {
      expect(item.x).toBeGreaterThan(0)
      expect(item.x).toBeLessThan(1)
      expect(item.y).toBeGreaterThan(0)
      expect(item.y).toBeLessThan(1)
    }
  })

  it('id が重複しない', () => {
    const ids = sheet().items.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('同じ種なら同じ並びになる', () => {
    expect(sheet(0, 'x')).toEqual(sheet(0, 'x'))
  })

  it('種が変われば並びが変わる', () => {
    expect(sheet(0, 'x').items).not.toEqual(sheet(0, 'y').items)
  })

  it('級が上限を超えても落ちない', () => {
    expect(buildBpSheet({ seed: 'day', level: 99 }).items).toHaveLength(BP_SHEET.itemCount)
  })

  it('数が 0 以下なら流さない', () => {
    const empty = buildBpSheet({ seed: 'day', count: 0 })
    expect(empty.items).toEqual([])
    expect(empty.durationMs).toBe(0)
  })
})

describe('scoreBpSheet', () => {
  const targetIds = () =>
    sheet()
      .items.filter((item) => item.target)
      .map((item) => item.id)
  const otherIds = () =>
    sheet()
      .items.filter((item) => !item.target)
      .map((item) => item.id)

  it('拾えた対象を数える', () => {
    expect(scoreBpSheet(sheet(), targetIds().slice(0, 4)).found).toBe(4)
  })

  it('拾い損ねた数を出す', () => {
    const built = sheet()
    expect(scoreBpSheet(built, targetIds().slice(0, 3)).missed).toBe(built.targetCount - 3)
  })

  it('対象でない文字を拾ったら wrong になる', () => {
    expect(scoreBpSheet(sheet(), otherIds().slice(0, 5)).wrong).toBe(5)
  })

  it('同じ文字を何度拾っても1回として数える', () => {
    const first = targetIds()[0]!
    expect(scoreBpSheet(sheet(), [first, first, first]).found).toBe(1)
  })

  it('知らない id を渡しても数えない', () => {
    const result = scoreBpSheet(sheet(), ['bp-9999'])
    expect(result.found).toBe(0)
    expect(result.wrong).toBe(0)
  })

  it('全部拾えば precision は低くなる', () => {
    const all = sheet().items.map((item) => item.id)
    const result = scoreBpSheet(sheet(), all)
    expect(result.found).toBe(sheet().targetCount)
    expect(result.precision).toBeLessThan(50)
  })

  it('一つも拾わなければ precision は 0', () => {
    expect(scoreBpSheet(sheet(), []).precision).toBe(0)
  })
})

describe('BP_SHEET の設定', () => {
  it('滞留時間が短くなる順に並んでいる', () => {
    const limits = BP_SHEET.lifetimeMs
    for (let i = 1; i < limits.length; i += 1) {
      expect(limits[i]!).toBeLessThan(limits[i - 1]!)
    }
  })

  it('上がる基準が戻る基準より高い', () => {
    expect(BP_SHEET.advanceAccuracy).toBeGreaterThan(BP_SHEET.fallbackAccuracy)
  })
})
