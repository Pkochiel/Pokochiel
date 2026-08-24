import { expect, test } from '@playwright/test'

test('ランディングからトレーニングへ遷移できる', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('読んだ内容を保っていられる力')

  await page.getByRole('link', { name: 'トレーニングを始める' }).click()
  await expect(page).toHaveURL(/\/btr$/)
  await expect(page.getByRole('heading', { name: '今日はどれくらい取れますか' })).toBeVisible()
})

test('主要ページが横スクロールを発生させない', async ({ page }) => {
  for (const path of ['/', '/dashboard', '/progress', '/btr', '/baseline']) {
    await page.goto(path)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${path} で横スクロールが発生している`).toBeLessThanOrEqual(0)
  }
})

test('ホームから推移へナビゲーションできる', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByRole('link', { name: '推移', exact: true }).first().click()
  await expect(page).toHaveURL(/\/progress$/)
  await expect(page.getByRole('heading', { name: '推移' })).toBeVisible()
})
