import { expect, test, type Page } from '@playwright/test'
import { waitForServiceWorker } from './helpers/storage'

const DASHBOARD_HEADING = /今日のトレーニング|今日はもう済んでいます/

/**
 * 新しいビルドを配ったときの Service Worker の入れ替わりを確認する。
 *
 * 実際のデプロイでは登録 URL の ?build= が変わることで install → activate が走る。
 * ここではビルドし直す代わりに、同じ仕組みを直接叩いて挙動を確かめる。
 */
async function activateBuild(page: Page, build: string): Promise<void> {
  await page.evaluate(
    (id: string) => navigator.serviceWorker.register(`/sw.js?build=${id}`, { scope: '/' }),
    build,
  )
  await waitForServiceWorker(page, build)
}

const cacheNames = (page: Page) => page.evaluate(() => caches.keys())

test('新しいビルドに入れ替わると、古いキャッシュが残らない', async ({ page }) => {
  await page.goto('/dashboard')
  await waitForServiceWorker(page)

  await activateBuild(page, 'test-a')
  expect(await cacheNames(page)).toContain('srl-shell-test-a')

  await activateBuild(page, 'test-b')
  const after = await cacheNames(page)

  expect(after).toContain('srl-shell-test-b')
  expect(after).toContain('srl-asset-test-b')
  // 旧ビルドの JS / CSS が residue として残らない
  expect(after.filter((name) => name.includes('test-a'))).toEqual([])
})

test('ビルドが入れ替わったあともオフラインで起動できる', async ({ page, context }) => {
  await page.goto('/dashboard')
  await waitForServiceWorker(page)
  await activateBuild(page, 'test-a')
  await activateBuild(page, 'test-b')

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('heading', { name: DASHBOARD_HEADING })).toBeVisible()
  await context.setOffline(false)
})

test('HTML をキャッシュするとき、その HTML が参照する JS / CSS も取り込む', async ({
  page,
  context,
}) => {
  await page.goto('/dashboard')
  await waitForServiceWorker(page)
  await activateBuild(page, 'test-c')

  const assets = await page.evaluate(async () => {
    const cache = await caches.open('srl-asset-test-c')
    return (await cache.keys()).map((request) => new URL(request.url).pathname)
  })
  expect(assets.length).toBeGreaterThan(0)
  expect(assets.every((path) => path.startsWith('/_next/static/'))).toBe(true)

  // 取り込んだ資産だけでトレーニング画面まで開ける
  await context.setOffline(true)
  await page.goto('/btr/saccade')
  await expect(page.getByRole('button', { name: 'はじめる' })).toBeVisible()
  await context.setOffline(false)
})
