import { expect, test, type Page } from '@playwright/test'
import { waitForRecords } from './helpers/storage'

/**
 * BTRメソッドの通し。
 *
 * 90分を最後まで走らせるのは現実的でないので、次の3つに絞って確かめる。
 *
 *   1. 選んだ長さに合わせて献立が組まれること
 *   2. 種目を終えると、その場で §5 の形の記録が残ること
 *   3. 残った記録が次の回の級（＝制限時間）を決めること
 */

interface StoredBtrResult {
  exercise: string
  variant: string | null
  score: number
  attempts: number[]
  elapsedMs: number | null
  timeLimitMs: number | null
  accuracy: number | null
  level: number | null
  judgement: string | null
  lowerIsBetter: boolean
  cpm: number | null
  valid: boolean
  localDate: string
}

/** ロジカルテストで2回上がった記録を仕込む。 */
async function seedAdvancedLogicalTest(page: Page) {
  await page.addInitScript(() => {
    const base = {
      userId: 'local-user',
      sessionId: 'seed',
      exercise: 'logical_test',
      variant: null,
      score: 30,
      attempts: [],
      elapsedMs: 300_000,
      accuracy: 100,
      judgement: 'advance',
      lowerIsBetter: false,
      cpm: null,
      valid: true,
      localDate: '2026-08-20',
    }
    window.localStorage.setItem(
      'srl:v1:btr_results',
      JSON.stringify([
        { ...base, id: 'seed-0', level: 0, timeLimitMs: 300_000, createdAt: '2026-08-20T01:00:00.000Z' },
        { ...base, id: 'seed-1', level: 1, timeLimitMs: 240_000, createdAt: '2026-08-20T02:00:00.000Z' },
      ]),
    )
  })
}

test('長さを選ぶと、その長さぶんの献立が組まれる', async ({ page }) => {
  await page.goto('/btr')
  await expect(page.getByRole('heading', { name: '今日はどれくらい取れますか' })).toBeVisible()

  await page.getByRole('link', { name: /^15 分/ }).click()
  await expect(page).toHaveURL(/\/btr\/session\/15$/)

  // どの長さでもサッケイドと倍速読書は入る。
  await expect(page.getByText('サッケイド')).toBeVisible()
  await expect(page.getByText('倍速読書')).toBeVisible()
  // 15分では処理系を入れない。
  await expect(page.getByText('読書内容への集中')).toHaveCount(0)
})

test('90分は4段階をひととおり通す', async ({ page }) => {
  await page.goto('/btr/session/90')
  for (const stage of ['準備', '認知視野の拡大', '読書内容への集中', '読書']) {
    await expect(page.getByText(stage).first()).toBeVisible()
  }
  // 普通読書は90分にだけ入る。
  await expect(page.getByText('普通読書')).toBeVisible()
})

test('種目を終えると記録が残り、Dashboard に出る', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '実時間で60秒かかるため desktop でのみ実行する')
  test.setTimeout(180_000)

  await page.goto('/btr/session/15')
  await page.getByRole('button', { name: 'はじめる' }).click()

  // 1種目め（カウント呼吸法）。60秒たつと自動で結果になる。
  await page.getByRole('button', { name: '数えはじめる' }).click()
  for (let i = 0; i < 8; i += 1) {
    await page.locator('main button').first().click({ force: true })
    await page.waitForTimeout(200)
  }
  await expect(page.getByRole('button', { name: 'トレーニングへ' })).toBeVisible({
    timeout: 90_000,
  })
  await page.getByRole('button', { name: 'トレーニングへ' }).click()

  const [record] = await waitForRecords<StoredBtrResult>(page, 'btrResults', 1, 20_000)
  expect(record?.exercise).toBe('breathing')
  expect(record?.score).toBe(8)
  // 呼吸法だけは少ないほうがよい。記録に残していないと推移の向きを決められない。
  expect(record?.lowerIsBetter).toBe(true)
  // 級を持たない種目なので、級も判定も付かない。
  expect(record?.level).toBeNull()
  expect(record?.judgement).toBeNull()
  expect(record?.valid).toBe(true)

  await page.goto('/dashboard')
  await expect(page.getByText('今日はもう済んでいます')).toBeVisible()
  await expect(page.getByText('カウント呼吸法')).toBeVisible()
})

test('記録が次の回の制限時間を決める', async ({ page }) => {
  // 級とは「課される制限時間の短さ」のこと。記録から引き直す。
  await page.goto('/btr/logical-test')
  await expect(page.getByText('30 問を 300 秒で。')).toBeVisible()

  await seedAdvancedLogicalTest(page)
  await page.goto('/btr/logical-test')
  await expect(page.getByText('30 問を 180 秒で。')).toBeVisible()
})

test('種目はひとつずつでも開ける', async ({ page }) => {
  for (const [slug, marker] of [
    ['saccade', '印から印へ目だけを飛ばして'],
    ['number-random', '順に押してください'],
    ['kana-pickup', '物語の内容も考えながら'],
    ['image-memory', '縦書きで右から左へ並びます'],
    ['paced-reading', '自分の本'],
  ] as const) {
    await page.goto(`/btr/${slug}`)
    await expect(page.getByText(marker).first()).toBeVisible()
  }
})
