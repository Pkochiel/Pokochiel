import { expect, test, type Page } from '@playwright/test'

/**
 * Baseline 教材は 888 文字。CPM が現実的な範囲（maxPlausibleCpm = 6000）に
 * 収まるには最低でも約 9 秒必要なので、余裕をみて滞在する。
 * 実際の読書ではなくフローの検証が目的だが、計測の妥当性判定を迂回しない。
 */
const READING_DWELL_MS = 12_000

async function completeBaseline(page: Page) {
  await page.goto('/baseline/read')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.getByRole('button', { name: 'Finished' })).toBeVisible()
  await page.waitForTimeout(READING_DWELL_MS)
  await page.getByRole('button', { name: 'Finished' }).click()

  // 設問（5問）。最初の選択肢を選び続ける。
  for (let i = 0; i < 5; i += 1) {
    await expect(page.getByText(`${i + 1} / 5`)).toBeVisible()
    await page.getByRole('listitem').first().getByRole('button').click()
  }

  await page
    .getByRole('textbox')
    .fill('主張は配置が効果を左右すること\n根拠として三つの働きが挙げられていた\n最後に計画への提言があった')
  await page.getByRole('button', { name: '入力を確定する' }).click()

  await expect(page.getByText('Key Points')).toBeVisible()
  await page.getByRole('button', { name: '75%' }).click()
  await page.getByRole('button', { name: '結果を見る' }).click()
}

test('Baseline Test を完走し、結果が表示され端末に保存される', async ({ page }) => {
  await completeBaseline(page)

  await expect(page.getByRole('heading', { name: '現在地を測定しました' })).toBeVisible()
  await expect(page.getByText('Reading Speed')).toBeVisible()
  await expect(page.getByText('Immediate Recall')).toBeVisible()
  await expect(page.getByText('明日からの目標速度')).toBeVisible()
  // 妥当な計測なので警告は出ない
  await expect(page.getByText('保存していません')).toHaveCount(0)

  const stored = await page.evaluate(() => ({
    profile: window.localStorage.getItem('srl:v1:profile'),
    readingTests: window.localStorage.getItem('srl:v1:reading_tests'),
    recallTasks: window.localStorage.getItem('srl:v1:recall_tasks'),
    sessions: window.localStorage.getItem('srl:v1:sessions'),
  }))

  const profile = JSON.parse(stored.profile ?? 'null')
  expect(profile.baselineCpm).toBeGreaterThan(0)
  expect(profile.targetCpm).toBeGreaterThan(profile.baselineCpm)
  expect(profile.onboardedAt).not.toBeNull()

  const readingTests = JSON.parse(stored.readingTests ?? '[]')
  expect(readingTests).toHaveLength(1)
  expect(readingTests[0].isBaseline).toBe(true)
  expect(readingTests[0].recallScore).toBe(75)
  expect(readingTests[0].characterCount).toBe(888)

  // 翌日の Recall が1件予約されている
  const recallTasks = JSON.parse(stored.recallTasks ?? '[]')
  expect(recallTasks).toHaveLength(1)
  expect(recallTasks[0].status).toBe('pending')
  expect(recallTasks[0].passageId).toBe(readingTests[0].passageId)

  const sessions = JSON.parse(stored.sessions ?? '[]')
  expect(sessions[0].sessionType).toBe('baseline')
  expect(sessions[0].completedAt).not.toBeNull()
})

test('飛ばし読みは基準値として保存されない', async ({ page }) => {
  await page.goto('/baseline/read')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Finished' }).click()

  for (let i = 0; i < 5; i += 1) {
    await page.getByRole('listitem').first().getByRole('button').click()
  }
  await page.getByRole('textbox').fill('あまり覚えていない')
  await page.getByRole('button', { name: '入力を確定する' }).click()
  await page.getByRole('button', { name: '0%', exact: true }).click()
  await page.getByRole('button', { name: '結果を見る' }).click()

  await expect(page.getByText('保存していません')).toBeVisible()

  const profile = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('srl:v1:profile') ?? 'null'),
  )
  // 壊れた計測で基準値を汚染しない
  expect(profile.baselineCpm).toBeNull()
})

test('Baseline 完了後、Dashboard に自分の CPM と目標速度が表示される', async ({ page }) => {
  await completeBaseline(page)
  await expect(page.getByRole('heading', { name: '現在地を測定しました' })).toBeVisible()

  await page.getByRole('link', { name: 'Dashboard へ' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  // Baseline を終えたので案内は消え、実測値が出ている
  await expect(page.getByText('Baseline Test が未実施です')).toHaveCount(0)
  await expect(page.getByText('今日の目標速度')).toBeVisible()

  // ラベルは CSS で大文字化しているだけなので、DOM 上は 'Current CPM'
  const cpmTile = page.locator('div').filter({ hasText: /^Current CPM/ }).last()
  await expect(cpmTile).toBeVisible()
  await expect(cpmTile).not.toContainText('—')
  await expect(page.getByText(/直近 \d+ 件の実績から算出しています/)).toBeVisible()
})

test('読了せずに設問へ進めない', async ({ page }) => {
  await page.goto('/baseline/read')
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByText('1 / 5')).toHaveCount(0)
})
