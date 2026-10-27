import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import {
  clearStoredData,
  readCollection,
  waitForRecords,
  waitForServiceWorker,
} from './helpers/storage'

const DASHBOARD_HEADING = /今日のトレーニング|今日はもう済んでいます/

/**
 * Phase 2 の要件確認。
 *
 * インターネット接続とアカウント登録が無くても、トレーニング / 推移 / 想起が
 * そのまま使えること。Cloud 同期は存在しない前提で全機能が動く必要がある。
 */

/** Phase 1 の localStorage に記録がある端末を再現する（1 度だけ書く）。 */
async function seedLegacyData(page: Page, options: { withRecallTask?: boolean } = {}) {
  await page.addInitScript((withRecallTask: boolean) => {
    if (window.localStorage.getItem('e2e:seeded') === '1') return
    window.localStorage.setItem('e2e:seeded', '1')
    window.localStorage.setItem(
      'srl:v1:profile',
      JSON.stringify({
        id: 'local-user',
        displayName: null,
        baselineCpm: 640,
        targetCpm: 736,
        preferredDurationMinutes: 30,
        chunkLevel: 2,
        timezone: 'Asia/Tokyo',
        onboardedAt: '2026-08-18T00:00:00.000Z',
        createdAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
      }),
    )
    if (!withRecallTask) return
    window.localStorage.setItem(
      'srl:v1:recall_tasks',
      JSON.stringify([
        {
          id: 'task-1',
          userId: 'local-user',
          passageId: 'biz-001',
          sourceSessionId: null,
          // 予定日は過去・期限は十分先。タイムゾーンに関係なく「今日やる対象」になる。
          scheduledDate: '2026-01-05',
          expiresOn: '2099-12-31',
          completedAt: null,
          recallScore: null,
          recallText: null,
          status: 'pending',
          createdAt: '2026-01-04T00:00:00.000Z',
        },
      ]),
    )
  }, options.withRecallTask ?? false)
}

test('ネットワークを切っても起動して Dashboard が開ける', async ({ page, context }) => {
  await page.goto('/dashboard')
  await waitForServiceWorker(page)

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('heading', { name: DASHBOARD_HEADING })).toBeVisible()
  await context.setOffline(false)
})

test('オフラインでも続けられることを画面で伝える', async ({ page }) => {
  // 表示の判断材料は navigator.onLine だが、この値がオフライン化で更新されるかは
  // ブラウザの実装差がある。ここでは UI が読む値そのものを固定し、表示だけを見る
  // （通信を止めたときの実際の動作は、このファイルの他のテストが確認している）。
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
  })
  await page.goto('/dashboard')

  await expect(page.getByRole('status')).toContainText('オフライン')
  await expect(page.getByRole('status')).toContainText('このまま続けられます')
})

test('オフラインのままトレーニング画面まで開ける', async ({ page, context }) => {
  await page.goto('/dashboard')
  await waitForServiceWorker(page)

  await context.setOffline(true)
  await page.goto('/btr/saccade')
  await expect(page.getByRole('button', { name: 'はじめる' })).toBeVisible()

  await page.goto('/progress')
  await expect(page.getByRole('heading', { name: '推移' })).toBeVisible()
  await context.setOffline(false)
})

test('オフラインで登録した本が、再読み込み後も残る', async ({ page, context }) => {
  // 本の控えは記録用の保存先とは別（設定にあたるので単独の鍵で持っている）。
  // そちらもオフラインで書けることを確かめる。
  await page.goto('/btr/paced-reading')
  await waitForServiceWorker(page)

  await context.setOffline(true)
  await page.getByRole('button', { name: '本を選ぶ' }).click()
  await page.locator('input').first().fill('オフラインで登録した本')
  await page.locator('input[type=number]').fill('620')
  await page.getByRole('button', { name: '登録して読みはじめる' }).click()
  await expect(page.getByText('『オフラインで登録した本』')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: '本を選ぶ' }).click()
  await expect(page.getByRole('button', { name: /オフラインで登録した本/ })).toBeVisible()
  await context.setOffline(false)
})

test('オフラインでも翌日 Recall を実施して保存できる', async ({ page, context }) => {
  await seedLegacyData(page, { withRecallTask: true })
  await page.goto('/dashboard')
  await waitForServiceWorker(page)
  await waitForRecords(page, 'recallTasks')

  await context.setOffline(true)
  await page.goto('/recall')

  await page.getByRole('textbox').fill('オフラインで書いた再現内容')
  await page.getByRole('button', { name: '入力を確定する' }).click()
  await page.getByRole('button', { name: '50%', exact: true }).click()
  await page.getByRole('button', { name: '完了' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)

  const [task] = await waitForRecords<{ status: string; recallScore: number }>(page, 'recallTasks')
  expect(task?.status).toBe('completed')
  expect(task?.recallScore).toBe(50)
  await context.setOffline(false)
})

test('Phase 1 の localStorage の記録を引き継ぐ', async ({ page }) => {
  await seedLegacyData(page)
  await page.goto('/settings')

  const [profile] = await waitForRecords<{ baselineCpm: number }>(page, 'profile')
  expect(profile?.baselineCpm).toBe(640)

  // 移送後は旧キーを残さない（正となる保存先を 1 つに保つ）
  const leftover = await page.evaluate(() => window.localStorage.getItem('srl:v1:profile'))
  expect(leftover).toBeNull()
})

test('記録を書き出して復元できる', async ({ page }) => {
  await seedLegacyData(page)
  await page.goto('/settings')
  await waitForRecords(page, 'profile')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'JSON を書き出す' }).click(),
  ])
  const file = await download.path()
  const contents = readFileSync(file, 'utf8')
  expect(JSON.parse(contents).format).toBe('speed-reading-lab.backup')
  await expect(page.getByText(/件の記録を書き出しました/)).toBeVisible()

  await clearStoredData(page)
  expect(await readCollection(page, 'profile')).toHaveLength(0)

  await page.getByLabel('バックアップファイル').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents, 'utf8'),
  })

  await expect(page.getByText(/件を復元しました/)).toBeVisible()
  const [restored] = await readCollection<{ baselineCpm: number }>(page, 'profile')
  expect(restored?.baselineCpm).toBe(640)
})
