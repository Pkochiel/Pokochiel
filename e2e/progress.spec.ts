import { expect, test, type Page } from '@playwright/test'

const DAYS = ['2026-08-17', '2026-08-18', '2026-08-19']

/**
 * 記録を仕込む。
 *
 * Phase 1 の localStorage に置くと、アプリ起動時の移送でそのまま
 * IndexedDB へ入る（その経路も一緒に確かめられる）。
 */
async function seedHistory(page: Page) {
  await page.addInitScript((days: string[]) => {
    window.localStorage.setItem(
      'srl:v1:profile',
      JSON.stringify({
        id: 'local-user',
        displayName: null,
        baselineCpm: 500,
        targetCpm: null,
        baselineProfile: null,
        usedBaselinePassageIds: [],
        preferredDurationMinutes: 30,
        chunkLevel: 2,
        meaningFlashLevel: 2,
        timezone: 'Asia/Tokyo',
        onboardedAt: '2026-08-13T09:00:00.000Z',
        createdAt: '2026-08-13T09:00:00.000Z',
        updatedAt: '2026-08-19T09:00:00.000Z',
      }),
    )

    const base = {
      userId: 'local-user',
      sessionId: 'seed',
      attempts: [],
      elapsedMs: 60_000,
      timeLimitMs: 60_000,
      accuracy: 92,
      judgement: 'stay',
      lowerIsBetter: false,
      cpm: null,
      valid: true,
    }

    const rows = days.flatMap((day, i) => [
      {
        ...base,
        id: `sac-${i}`,
        exercise: 'saccade',
        variant: 'horizontal',
        score: 40 + i * 6,
        level: 1,
        localDate: day,
        createdAt: `${day}T09:00:00.000Z`,
      },
      {
        ...base,
        id: `read-${i}`,
        exercise: 'paced_reading',
        variant: null,
        score: 6 + i,
        level: null,
        cpm: 900 + i * 150,
        localDate: day,
        createdAt: `${day}T09:20:00.000Z`,
      },
    ])
    window.localStorage.setItem('srl:v1:btr_results', JSON.stringify(rows))
  }, DAYS)
}

test('記録がなければ、まだ何もないことを示す', async ({ page }) => {
  await page.goto('/progress')
  await expect(page.getByRole('heading', { name: '推移' })).toBeVisible()
  await expect(page.getByText('まだ記録がありません。')).toBeVisible()
})

test('記録があれば種目ごとに並び、読書の伸びが出る', async ({ page }) => {
  await seedHistory(page)
  await page.goto('/progress')

  // 種目ごとの行。総合点ひとつではなく、種目の名前で並ぶ。
  await expect(page.getByText('よこサッケイド')).toBeVisible()
  await expect(page.getByText('倍速読書', { exact: true })).toBeVisible()

  // 級は種目ごとに独立して付く。
  await expect(page.getByText('5級')).toBeVisible()

  // 読書の伸びは倍速読書の記録だけで測る（1200 / 500 = 2.4 倍）。
  await expect(page.getByText('読書の伸び')).toBeVisible()
  await expect(page.getByText('2.4')).toBeVisible()

  // 折れ線は代替テキストから辿れる（色に頼らない）。
  await expect(page.getByRole('img', { name: 'よこサッケイド の推移' })).toBeVisible()
})

test('設定では1回の長さを決めない', async ({ page }) => {
  // その日どれだけ取れるかは日によって違うので、始めるたびに選ぶ。
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: '設定' })).toBeVisible()
  await expect(page.getByText('始めるたびに選びます。ここでは決めません。')).toBeVisible()
})
