import { expect, test, type Page } from '@playwright/test'

/**
 * MVP の Definition of Done：
 * Baseline を終えたユーザーが Daily Training を最後まで完走し、
 * 結果が保存されて Dashboard に反映されること。
 *
 * 実行時間を抑えるため、Baseline 済みで読書速度が速いプロフィールを与えている
 * （速度が上がるとチャンクの表示間隔が短くなる。ただし安全下限 250ms は超えない）。
 */
const SEEDED_PROFILE = {
  id: 'local-user',
  displayName: null,
  baselineCpm: 1800,
  targetCpm: 2000,
  preferredDurationMinutes: 30,
  chunkLevel: 2,
  timezone: 'Asia/Tokyo',
  onboardedAt: '2026-08-18T09:00:00.000Z',
  createdAt: '2026-08-18T09:00:00.000Z',
  updatedAt: '2026-08-18T09:00:00.000Z',
}

const READING_DWELL_MS = 6000

async function seedProfile(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem('srl:v1:profile', JSON.stringify(profile))
  }, SEEDED_PROFILE)
}

/** 選択肢を1つ選ぶ（リスト内の最初のボタン）。 */
async function answerFirstChoice(page: Page) {
  await page.getByRole('listitem').first().getByRole('button').click()
}

test.describe('Daily Training', () => {
  test('Warm-up から Recall まで完走し、結果が保存される', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '所要時間が長いため desktop でのみ実行する')
    test.setTimeout(180_000)
    await seedProfile(page)
    await page.goto('/training')

    // 01 Warm-up
    await expect(page.getByRole('heading', { name: '読む姿勢をつくる' })).toBeVisible()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForTimeout(READING_DWELL_MS)
    await page.getByRole('button', { name: '読み終えた' }).click()

    // 02 Speed Push
    await expect(page.getByText('Speed Push', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForTimeout(READING_DWELL_MS)
    await page.getByRole('button', { name: '読み終えた' }).click()
    await expect(page.getByText('理解度チェック')).toBeVisible()
    for (let i = 0; i < 3; i += 1) await answerFirstChoice(page)

    // 03 Chunk Reading（自動送りが終わるまで待つ）
    await expect(page.getByRole('heading', { name: '意味のまとまりで捉える' })).toBeVisible()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByText('意味が取れていたか')).toBeVisible({ timeout: 90_000 })
    for (let i = 0; i < 3; i += 1) await answerFirstChoice(page)

    // 04 Structure Reading（段落数は教材による）
    await expect(page.getByText('Structure Reading', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Start' }).click()
    for (let guard = 0; guard < 12; guard += 1) {
      await expect(page.getByText('結局この段落は何を言っている？')).toBeVisible()
      await answerFirstChoice(page)
      const toResult = page.getByRole('button', { name: '結果へ' })
      if (await toResult.isVisible()) {
        await toResult.click()
        break
      }
      await page.getByRole('button', { name: '次の段落へ' }).click()
    }

    // 05 Comprehension Test
    await expect(page.getByText('Comprehension Test', { exact: true }).first()).toBeVisible()
    for (let i = 0; i < 5; i += 1) await answerFirstChoice(page)
    await expect(page.getByText(/\d+ \/ \d+ 問正解/)).toBeVisible()
    await page.getByRole('button', { name: '次へ' }).click()

    // 06 Immediate Recall
    await expect(
      page.getByRole('heading', { name: /今読んだ内容を、見ずに3〜5項目で再現してください/ }),
    ).toBeVisible()
    await page.getByRole('textbox').fill('主張を1つ\n根拠を1つ\n結論を1つ')
    await page.getByRole('button', { name: '入力を確定する' }).click()
    await page.getByRole('button', { name: '75%' }).click()
    await page.getByRole('button', { name: '結果を見る' }).click()

    // セッション結果
    await expect(
      page.getByRole('heading', { name: '今日のトレーニングが終わりました' }),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/次回の目標速度を/)).toBeVisible()

    // 保存内容の確認
    const stored = await page.evaluate(() => ({
      results: JSON.parse(window.localStorage.getItem('srl:v1:results') ?? '[]'),
      sessions: JSON.parse(window.localStorage.getItem('srl:v1:sessions') ?? '[]'),
      recallTasks: JSON.parse(window.localStorage.getItem('srl:v1:recall_tasks') ?? '[]'),
      profile: JSON.parse(window.localStorage.getItem('srl:v1:profile') ?? 'null'),
    }))

    // 6 ブロックすべての結果が残っている
    expect(stored.results).toHaveLength(6)
    const types = stored.results.map((r: { trainingType: string }) => r.trainingType)
    expect(types).toEqual([
      'warmup',
      'speed_push',
      'chunk_reading',
      'structure_reading',
      'comprehension',
      'immediate_recall',
    ])

    // 速度・理解・想起がそれぞれ記録されている
    expect(stored.results[1].cpm).toBeGreaterThan(0)
    expect(stored.results[4].comprehensionScore).not.toBeNull()
    expect(stored.results[5].immediateRecallScore).toBe(75)

    // セッションが完了扱いになり、翌日の Recall が予約されている
    expect(stored.sessions[0].sessionType).toBe('daily')
    expect(stored.sessions[0].completedAt).not.toBeNull()
    expect(stored.recallTasks.length).toBeGreaterThan(0)
    expect(stored.recallTasks[0].status).toBe('pending')

    // 目標速度が更新されている
    expect(stored.profile.targetCpm).toBeGreaterThan(0)

    // Dashboard に反映される
    await page.getByRole('link', { name: 'Dashboard へ' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByText('今日の目標速度')).toBeVisible()
    await expect(page.getByText(/直近 \d+ 件の実績から算出しています/)).toBeVisible()
  })
})
