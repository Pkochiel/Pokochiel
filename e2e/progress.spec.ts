import { expect, test, type Page } from '@playwright/test'

const DAYS = ['2026-08-17', '2026-08-18', '2026-08-19']

async function seedHistory(page: Page) {
  await page.addInitScript((days: string[]) => {
    const cpm = [660, 700, 715]
    const comprehension = [80, 85, 88]
    const recall = [75, 75, 100]
    window.localStorage.setItem(
      'srl:v1:profile',
      JSON.stringify({
        id: 'local-user',
        displayName: null,
        baselineCpm: 590,
        targetCpm: 715,
        preferredDurationMinutes: 30,
        chunkLevel: 2,
        timezone: 'Asia/Tokyo',
        onboardedAt: '2026-08-13T09:00:00.000Z',
        createdAt: '2026-08-13T09:00:00.000Z',
        updatedAt: '2026-08-19T09:00:00.000Z',
      }),
    )
    window.localStorage.setItem(
      'srl:v1:sessions',
      JSON.stringify(
        days.map((d, i) => ({
          id: `s${i}`,
          userId: 'local-user',
          startedAt: `${d}T09:00:00.000Z`,
          completedAt: `${d}T09:30:00.000Z`,
          durationSeconds: 1800,
          sessionType: 'daily',
          localDate: d,
        })),
      ),
    )
    window.localStorage.setItem(
      'srl:v1:results',
      JSON.stringify(
        days.flatMap((d, i) => [
          {
            id: `r${i}a`,
            userId: 'local-user',
            sessionId: `s${i}`,
            trainingType: 'speed_push',
            passageId: 'gen-003',
            cpm: cpm[i],
            comprehensionScore: comprehension[i],
            immediateRecallScore: null,
            delayedRecallScore: null,
            targetCpm: 700,
            backCount: 0,
            pauseCount: 0,
            chunkLevel: null,
            difficulty: 3,
            valid: true,
            createdAt: `${d}T09:10:00.000Z`,
          },
          {
            id: `r${i}b`,
            userId: 'local-user',
            sessionId: `s${i}`,
            trainingType: 'immediate_recall',
            passageId: 'his-001',
            cpm: null,
            comprehensionScore: null,
            immediateRecallScore: recall[i],
            delayedRecallScore: null,
            targetCpm: null,
            backCount: null,
            pauseCount: null,
            chunkLevel: null,
            difficulty: null,
            valid: true,
            createdAt: `${d}T09:25:00.000Z`,
          },
        ]),
      ),
    )
  }, DAYS)
}

test('実績がなければ Progress は空の状態を示す', async ({ page }) => {
  await page.goto('/progress')
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
  await expect(page.getByText('この期間の実績はまだありません。').first()).toBeVisible()
})

test('実績があれば推移とレーダーが表示され、数値でも確認できる', async ({ page }) => {
  await seedHistory(page)
  await page.goto('/progress')

  await expect(page.getByRole('img', { name: /の推移$/ }).first()).toBeVisible()
  await expect(page.getByRole('img', { name: '6軸の能力バランス' })).toBeVisible()

  // 色に頼らない代替経路（表）が存在する
  await page.getByText('数値で見る').first().click()
  await expect(page.getByRole('table').first()).toBeVisible()
  await expect(page.getByRole('cell', { name: '2026-08-19' }).first()).toBeVisible()

  // 期間を切り替えても落ちない
  await page.getByRole('tab', { name: '90 days' }).click()
  await expect(page.getByRole('img', { name: /の推移$/ }).first()).toBeVisible()
})

test('Settings で1日のトレーニング時間を変更できる', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: '20 分' }).click()
  await expect(page.getByText('保存しました。')).toBeVisible()

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('srl:v1:profile') ?? 'null'),
  )
  expect(stored.preferredDurationMinutes).toBe(20)
})
