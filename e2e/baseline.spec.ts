import { expect, test, type Page } from '@playwright/test'

/**
 * Baseline 教材は 1,100〜1,300 字。CPM が現実的な範囲（maxPlausibleCpm = 6000）に
 * 収まるには 12 秒以上必要なので、余裕をみて滞在する。
 * フローの検証が目的だが、計測の妥当性判定は迂回しない。
 */
const READING_DWELL_MS = 15_000

async function completeBaseline(page: Page, options: { dwellMs?: number } = {}) {
  await page.goto('/baseline/read')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.getByRole('button', { name: 'Finished' })).toBeVisible()
  await page.waitForTimeout(options.dwellMs ?? READING_DWELL_MS)
  await page.getByRole('button', { name: 'Finished' }).click()

  // 理解度テスト（8問）。最初の選択肢を選び続ける。
  for (let i = 0; i < 8; i += 1) {
    await expect(page.getByText(`${i + 1} / 8`)).toBeVisible()
    await page.getByRole('listitem').first().getByRole('button').click()
  }

  await page
    .getByRole('textbox')
    .fill('主張は見積りの誤差が構造的に生じること\n根拠として工程の抜けが挙げられていた\n最後に確認点の設置が提案されていた')
  await page.getByRole('button', { name: '入力を確定する' }).click()

  // Key Points の照合（主要な想起スコア）
  await expect(page.getByRole('heading', { name: '思い出せていた項目を選んでください' })).toBeVisible()
  const keyPoints = page.getByRole('listitem').filter({ has: page.getByRole('button') })
  await keyPoints.nth(0).getByRole('button').click()
  await keyPoints.nth(1).getByRole('button').click()

  await page.getByRole('button', { name: '75%' }).click()
  await page.getByRole('button', { name: '次へ' }).click()
}

test('Baseline Test を完走し、理解の内訳まで保存される', async ({ page }) => {
  test.setTimeout(90_000)
  await completeBaseline(page)

  await expect(page.getByRole('heading', { name: '現在地を測定しました' })).toBeVisible()
  await expect(page.getByText('理解の内訳')).toBeVisible()
  await expect(page.getByText('主張の把握')).toBeVisible()
  await expect(page.getByText('保存していません')).toHaveCount(0)

  const stored = await page.evaluate(() => ({
    profile: JSON.parse(window.localStorage.getItem('srl:v1:profile') ?? 'null'),
    readingTests: JSON.parse(window.localStorage.getItem('srl:v1:reading_tests') ?? '[]'),
    recallTasks: JSON.parse(window.localStorage.getItem('srl:v1:recall_tasks') ?? '[]'),
  }))

  expect(stored.profile.baselineCpm).toBeGreaterThan(0)
  expect(stored.profile.targetCpm).toBeGreaterThan(stored.profile.baselineCpm)

  // Baseline Profile に理解の内訳と想起が入っている
  expect(stored.profile.baselineProfile).not.toBeNull()
  expect(stored.profile.baselineProfile.mainIdea).not.toBeNull()
  expect(stored.profile.baselineProfile.causeEffect).not.toBeNull()
  expect(stored.profile.baselineProfile.structure).not.toBeNull()
  expect(stored.profile.baselineProfile.attempts).toBe(1)

  // 使用した教材が記録され、再測定で同じ文章が出ないようにしている
  expect(stored.profile.usedBaselinePassageIds).toHaveLength(1)

  const test0 = stored.readingTests[0]
  expect(test0.isBaseline).toBe(true)
  expect(test0.characterCount).toBeGreaterThanOrEqual(1200)
  expect(test0.typeScores).not.toBeNull()

  // 想起は Key Point の照合から算出される（自己評価 75% とは一致しない）
  expect(test0.recallScore).toBeGreaterThan(0)
  expect(test0.recallScore).not.toBe(75)

  expect(stored.recallTasks).toHaveLength(1)
})

test('2回目の Baseline では別の教材が出る', async ({ page }) => {
  test.setTimeout(120_000)
  await completeBaseline(page)
  await expect(page.getByRole('heading', { name: '現在地を測定しました' })).toBeVisible()

  const firstPassage = await page.evaluate(
    () => JSON.parse(window.localStorage.getItem('srl:v1:reading_tests') ?? '[]')[0].passageId,
  )

  await page.goto('/baseline/read')
  await expect(page.getByText(/Baseline Test・2 回目/)).toBeVisible()
  await expect(page.getByText('前回とは別の文章を出しています。')).toBeVisible()

  await page.getByRole('button', { name: 'Start' }).click()
  await page.waitForTimeout(READING_DWELL_MS)
  await page.getByRole('button', { name: 'Finished' }).click()
  for (let i = 0; i < 8; i += 1) {
    await page.getByRole('listitem').first().getByRole('button').click()
  }
  await page.getByRole('textbox').fill('2回目の再現内容')
  await page.getByRole('button', { name: '入力を確定する' }).click()
  await page.getByRole('button', { name: '50%' }).click()
  await page.getByRole('button', { name: '次へ' }).click()

  const stored = await page.evaluate(() => ({
    tests: JSON.parse(window.localStorage.getItem('srl:v1:reading_tests') ?? '[]'),
    profile: JSON.parse(window.localStorage.getItem('srl:v1:profile') ?? 'null'),
  }))

  expect(stored.tests).toHaveLength(2)
  expect(stored.tests[1].passageId).not.toBe(firstPassage)
  expect(stored.profile.baselineProfile.attempts).toBe(2)
  expect(stored.profile.usedBaselinePassageIds).toHaveLength(2)
})

test('飛ばし読みは基準値として保存されない', async ({ page }) => {
  await page.goto('/baseline/read')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Finished' }).click()

  for (let i = 0; i < 8; i += 1) {
    await page.getByRole('listitem').first().getByRole('button').click()
  }
  await page.getByRole('textbox').fill('あまり覚えていない')
  await page.getByRole('button', { name: '入力を確定する' }).click()
  await page.getByRole('button', { name: '0%', exact: true }).click()
  await page.getByRole('button', { name: '次へ' }).click()

  await expect(page.getByText('保存していません')).toBeVisible()

  const profile = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('srl:v1:profile') ?? 'null'),
  )
  expect(profile.baselineCpm).toBeNull()
})

test('読了せずに設問へ進めない', async ({ page }) => {
  await page.goto('/baseline/read')
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByText('1 / 8')).toHaveCount(0)
})
