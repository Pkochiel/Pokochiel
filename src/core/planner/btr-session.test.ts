import { describe, expect, it } from 'vitest'
import { BTR_EXERCISES, btrExercise, btrRotationPool } from '../training/btr/exercises'
import {
  BTR_SESSION_MINUTES,
  buildBtrSession,
  type BtrSessionMinutes,
} from './btr-session'

const SEED = '2026-08-22'

describe('buildBtrSession', () => {
  it.each(BTR_SESSION_MINUTES)('%i分の回は合計がその長さに収まる', (minutes) => {
    const session = buildBtrSession({ minutes, seed: SEED })
    expect(session.totalMinutes + session.reviewMinutes).toBe(minutes)
  })

  it.each(BTR_SESSION_MINUTES)('%i分でもサッケイドと倍速読書は必ず入る', (minutes) => {
    // 入口（眼）と出口（実際の読書）を欠くと、その日が何のためだったか分からなくなる。
    const ids = buildBtrSession({ minutes, seed: SEED }).blocks.map((b) => b.exercise)
    expect(ids).toContain('saccade')
    expect(ids).toContain('paced_reading')
  })

  it.each(BTR_SESSION_MINUTES)('%i分でもカウント呼吸法から始まる', (minutes) => {
    expect(buildBtrSession({ minutes, seed: SEED }).blocks[0]!.exercise).toBe('breathing')
  })

  it.each(BTR_SESSION_MINUTES)('%i分の回は倍速読書で終わる', (minutes) => {
    const blocks = buildBtrSession({ minutes, seed: SEED }).blocks
    expect(blocks[blocks.length - 1]!.exercise).toBe('paced_reading')
  })

  it('45分以下では普通読書を省く', () => {
    // どちらも入れると1種目あたりが短くなりすぎ、どちらの数字も測定にならない。
    for (const minutes of [45, 30, 15] as const) {
      const ids = buildBtrSession({ minutes, seed: SEED }).blocks.map((b) => b.exercise)
      expect(ids).not.toContain('normal_reading')
    }
    expect(buildBtrSession({ minutes: 90, seed: SEED }).blocks.map((b) => b.exercise)).toContain(
      'normal_reading',
    )
  })

  it('90分では処理系をひととおり通す', () => {
    const ids = buildBtrSession({ minutes: 90, seed: SEED }).blocks.map((b) => b.exercise)
    for (const id of btrRotationPool('focus')) expect(ids).toContain(id)
  })

  it('90分でも認知視野は全部はやらない', () => {
    // 毎回すべてはやらない。詰め込むより種目を替えながら続けるほうが伸びる。
    const pool = btrRotationPool('field')
    const ids = buildBtrSession({ minutes: 90, seed: SEED }).blocks.map((b) => b.exercise)
    const chosen = pool.filter((id) => ids.includes(id))
    expect(chosen.length).toBeLessThan(pool.length)
    expect(chosen.length).toBe(3)
  })

  it.each(BTR_SESSION_MINUTES)('%i分の回で同じ種目を二度置かない', (minutes) => {
    const ids = buildBtrSession({ minutes, seed: SEED }).blocks.map((b) => b.exercise)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(BTR_SESSION_MINUTES)('%i分の回はどのブロックも1分以上ある', (minutes) => {
    for (const block of buildBtrSession({ minutes, seed: SEED }).blocks) {
      expect(block.minutes).toBeGreaterThanOrEqual(1)
    }
  })

  it('段階の順に並ぶ', () => {
    // 眼から入って頭で終える。準備 → 眼 → 処理 → 実際の読書。
    const order = ['prepare', 'field', 'focus', 'reading']
    const stages = buildBtrSession({ minutes: 90, seed: SEED }).blocks.map((b) => b.stage)
    const ranks = stages.map((stage) => order.indexOf(stage))
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })

  it('通し番号が1から連番になる', () => {
    const blocks = buildBtrSession({ minutes: 90, seed: SEED }).blocks
    expect(blocks.map((b) => b.order)).toEqual(blocks.map((_, i) => i + 1))
  })

  it('読書のブロックは読み方を持つ', () => {
    const blocks = buildBtrSession({ minutes: 90, seed: SEED }).blocks
    expect(blocks.find((b) => b.exercise === 'normal_reading')?.mode).toBe('normal')
    expect(blocks.find((b) => b.exercise === 'paced_reading')?.mode).toBe('paced')
    expect(blocks.find((b) => b.exercise === 'saccade')?.mode).toBeUndefined()
  })

  it('同じ日なら同じ組み立てになる', () => {
    // 開き直しても内容が変わらないこと。
    expect(buildBtrSession({ minutes: 45, seed: SEED })).toEqual(
      buildBtrSession({ minutes: 45, seed: SEED }),
    )
  })

  it('日が変われば選ばれる種目も変わりうる', () => {
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) =>
        buildBtrSession({ minutes: 30, seed: `2026-09-${String(i + 1).padStart(2, '0')}` })
          .blocks.map((b) => b.exercise)
          .join(','),
      ),
    )
    expect(seen.size).toBeGreaterThan(1)
  })

  it('久しく触っていない種目から先に選ぶ', () => {
    // 種だけで選ぶと、何週間も出てこない種目ができる。
    const session = buildBtrSession({
      minutes: 30,
      seed: SEED,
      lastDoneAt: {
        number_random: '2026-08-21',
        unit_book: '2026-08-20',
        pattern_sheet: '2026-08-19',
        bp_sheet: '2026-06-01',
      },
    })
    expect(session.blocks.map((b) => b.exercise)).toContain('bp_sheet')
  })

  it('一度もやっていない種目を最優先する', () => {
    const session = buildBtrSession({
      minutes: 30,
      seed: SEED,
      lastDoneAt: {
        number_random: '2026-08-21',
        unit_book: '2026-08-21',
        pattern_sheet: '2026-08-21',
        // bp_sheet は未実施
      },
    })
    expect(session.blocks.map((b) => b.exercise)).toContain('bp_sheet')
  })

  it('分の配り方が元の比を保つ', () => {
    // 均等割りにすると、2分で足りる種目と10分要る種目が同じ長さになる。
    const session = buildBtrSession({ minutes: 90, seed: SEED })
    const focus = session.blocks.filter((b) => b.stage === 'focus')
    for (const block of focus) {
      expect(block.minutes).toBe(btrExercise(block.exercise).minutes)
    }
  })

  it('枠が狭ければ縮めて収める', () => {
    // 45分は処理系2種目で14分。8分の種目が2つ選ばれても超えない。
    const session = buildBtrSession({ minutes: 45, seed: SEED })
    const focus = session.blocks.filter((b) => b.stage === 'focus')
    expect(focus.reduce((sum, b) => sum + b.minutes, 0)).toBe(14)
  })

  it('15分では処理系を入れない', () => {
    const stages = buildBtrSession({ minutes: 15, seed: SEED }).blocks.map((b) => b.stage)
    expect(stages).not.toContain('focus')
  })
})

describe('BTR_EXERCISES', () => {
  it('id が重複しない', () => {
    const ids = BTR_EXERCISES.map((spec) => spec.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('90分の配分の合計が90分になる', () => {
    // 記録と振り返りの4分を除いた86分。
    const total = BTR_EXERCISES.reduce((sum, spec) => sum + spec.minutes, 0)
    // BPシートは日替わりで抜けるので、その6分を引くと86分。
    expect(total - btrExercise('bp_sheet').minutes).toBe(86)
  })

  it('課す条件が変わらない種目は級を持たない', () => {
    // 級とは制限時間の短さのこと。呼吸は状態の測定、かなひろいは2分固定、
    // 読書は自分の本を決まった時間読むだけなので、上げ下げする段がない。
    const unleveled = BTR_EXERCISES.filter((spec) => !spec.leveled).map((spec) => spec.id)
    expect(unleveled).toEqual([
      'breathing',
      'kana_pickup',
      'normal_reading',
      'paced_reading',
    ])
  })

  it('毎回入るのは呼吸・サッケイド・倍速読書だけ', () => {
    const always = BTR_EXERCISES.filter((spec) => spec.always).map((spec) => spec.id)
    expect(always).toEqual(['breathing', 'saccade', 'paced_reading'])
  })

  it('日替わりで回す種目に、毎回入る種目を混ぜない', () => {
    for (const stage of ['field', 'focus'] as const) {
      for (const id of btrRotationPool(stage)) expect(btrExercise(id).always).toBe(false)
    }
  })

  it('知らない種目を引いたら落とす', () => {
    // 黙って既定値を返すと、綴り違いが画面に出るまで気づけない。
    expect(() => btrExercise('nope' as never)).toThrow()
  })
})

describe('長さごとの型', () => {
  it.each(BTR_SESSION_MINUTES)('%i分は短いほうが種目数も少ない', (minutes) => {
    const count = buildBtrSession({ minutes, seed: SEED }).blocks.length
    const longer = BTR_SESSION_MINUTES.filter((m) => m > minutes)
    for (const other of longer) {
      expect(buildBtrSession({ minutes: other as BtrSessionMinutes, seed: SEED }).blocks.length)
        .toBeGreaterThanOrEqual(count)
    }
  })
})
