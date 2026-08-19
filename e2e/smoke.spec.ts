import { expect, test } from '@playwright/test'

test('ランディングから Dashboard へ遷移できる', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('速く理解し')

  await page.getByRole('link', { name: 'Dashboard を見る' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: /今日の\d+分トレーニングを開始/ })).toBeVisible()
})

test('主要ページが横スクロールを発生させない', async ({ page }) => {
  for (const path of ['/', '/dashboard', '/progress', '/training', '/baseline']) {
    await page.goto(path)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${path} で横スクロールが発生している`).toBeLessThanOrEqual(0)
  }
})

test('Dashboard から Progress へナビゲーションできる', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()
  await expect(page).toHaveURL(/\/progress$/)
  await expect(page.getByRole('tablist', { name: '表示期間' })).toBeVisible()
})
