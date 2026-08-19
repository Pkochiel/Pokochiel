import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 1.5 の通し確認。
 *
 * Baseline → Daily Training（Meaning Flash / Prediction / Variable Speed を含む）
 * → Recall → Dashboard までを1本で通す。
 *
 * 任意ブロックは Skill Profile の弱点から選ばれるため、
 * 対象の3つが必ず選ばれるように「弱い」実績を仕込んでおく。
 */
const WEAK_SKILL_SEED = ['meaning_flash', 'prediction_reading', 'variable_speed'] as const

/** 教材はおよそ 400 字。6000 CPM の妥当性上限を超えないだけの時間を置く。 */
const READING_DWELL_MS = 5000

async function seedWeakProfile(page: Page) {
  await page.addInitScript((types: readonly string[]) => {
    const day = (i: number) => `2026-08-${String(10 + i).padStart(2, '0')}`
    window.localStorage.setItem(
      'srl:v1:profile',
      JSON.stringify({
        id: 'local-user',
        displayName: null,
        baselineCpm: 1800,
        targetCpm: 2000,
        preferredDurationMinutes: 30,
        chunkLevel: 2,
        meaningFlashLevel: 2,
        timezone: 'Asia/Tokyo',
        onboardedAt: '2026-08-09T09:00:00.000Z',
        baselineProfile: null,
        usedBaselinePassageIds: [],
        createdAt: '2026-08-09T09:00:00.000Z',
        updatedAt: '2026-08-09T09:00:00.000Z',
      }),
    )
    window.localStorage.setItem(
      'srl:v1:sessions',
      JSON.stringify(
        [0, 1, 2].map((i) => ({
          id: `s${i}`,
          userId: 'local-user',
          startedAt: `${day(i)}T09:00:00.000Z`,
          completedAt: `${day(i)}T09:30:00.000Z`,
          durationSeconds: 1800,
          sessionType: 'daily',
          localDate: day(i),
        })),
      ),
    )
    window.localStorage.setItem(
      'srl:v1:results',
      JSON.stringify(
        [0, 1, 2].flatMap((i) =>
          types.map((type) => ({
            id: `${type}-${i}`,
            userId: 'local-user',
            sessionId: `s${i}`,
            trainingType: type,
            passageId: null,
            cpm: null,
            comprehensionScore: null,
            immediateRecallScore: null,
            delayedRecallScore: null,
            targetCpm: null,
            backCount: null,
            pauseCount: null,
            level: 2,
            accuracyScore: 20,
            exposureMs: null,
            difficulty: null,
            valid: true,
            createdAt: `${day(i)}T09:1${types.indexOf(type)}:00.000Z`,
          })),
        ),
      ),
    )
  }, WEAK_SKILL_SEED)
}

/**
 * 画面に出ているものを見て次の操作を決めるウォーカー。
 * 構成はプラン生成に依存して変わるため、ブロックの並びを決め打ちしない。
 */
async function advance(page: Page): Promise<'continue' | 'finished'> {
  const isVisible = async (locator: ReturnType<Page['getByRole']>) =>
    await locator.first().isVisible().catch(() => false)

  if (await isVisible(page.getByRole('heading', { name: '今日のトレーニングが終わりました' }))) {
    return 'finished'
  }

  const continueButton = page.getByRole('button', { name: /^続ける$|^結果を見る$/ })
  if (await isVisible(continueButton)) {
    await continueButton.first().click()
    return 'continue'
  }

  const start = page.getByRole('button', { name: 'Start' })
  if (await isVisible(start)) {
    await start.first().click()
    return 'continue'
  }

  const predict = page.getByRole('button', { name: '予測する' })
  if (await isVisible(predict)) {
    await predict.first().click()
    return 'continue'
  }

  const finishedReading = page.getByRole('button', { name: '読み終えた' })
  if (await isVisible(finishedReading)) {
    await page.waitForTimeout(READING_DWELL_MS)
    await finishedReading.first().click()
    return 'continue'
  }

  const skipSegment = page.getByRole('button', { name: 'この区間を読み終えた' })
  if (await isVisible(skipSegment)) {
    await skipSegment.first().click()
    return 'continue'
  }

  // Immediate Recall: 記述 → Key Point 照合 → 自己評価
  const recallHeading = page.getByRole('heading', {
    name: '思い出せていた項目を選んでください',
  })
  if (await isVisible(recallHeading)) {
    const keyPoints = page.getByRole('listitem').filter({ has: page.getByRole('button') })
    await keyPoints.nth(0).getByRole('button').click()
    await page.getByRole('button', { name: '75%' }).click()
    await page.getByRole('button', { name: '次へ' }).click()
    return 'continue'
  }

  const commitRecall = page.getByRole('button', { name: '入力を確定する' })
  if (await isVisible(commitRecall)) {
    await page.getByRole('textbox').fill('主張と根拠と結論をそれぞれ一行で')
    await commitRecall.click()
    return 'continue'
  }

  const nextButtons = page.getByRole('button', { name: /^次へ$|^次の段落へ$|^結果へ$|^次の停止位置へ$/ })
  if (await isVisible(nextButtons)) {
    await nextButtons.first().click()
    return 'continue'
  }

  // 設問・選択肢
  const choice = page.getByRole('listitem').filter({ has: page.getByRole('button') })
  if ((await choice.count()) > 0) {
    await choice.first().getByRole('button').click()
    return 'continue'
  }

  await page.waitForTimeout(400)
  return 'continue'
}

test.describe('Phase 1.5 通し', () => {
  test('Daily Training が新トレーニングを含めて完走し、Dashboard に反映される', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '所要時間が長いため desktop でのみ実行する')
    test.setTimeout(300_000)

    await seedWeakProfile(page)
    await page.goto('/training')

    // プランは初回表示時に生成・保存されるため、保存を待ってから読む
    await page.waitForFunction(
      () => JSON.parse(window.localStorage.getItem('srl:v1:plans') ?? '[]').length > 0,
      undefined,
      { timeout: 30_000 },
    )
    const plan = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('srl:v1:plans') ?? '[]'),
    )
    const types: string[] = plan[0].blocks.map((b: { type: string }) => b.type)
    expect(types).toContain('meaning_flash')
    expect(types).toContain('prediction_reading')
    expect(types).toContain('variable_speed')

    // コアのトレーニングは弱点に関わらず毎回含まれる
    for (const core of [
      'warmup',
      'speed_push',
      'structure_reading',
      'comprehension',
      'immediate_recall',
    ]) {
      expect(types).toContain(core)
    }

    // 合計は 30 分を超えない
    const total = plan[0].blocks.reduce(
      (sum: number, b: { minutes: number }) => sum + b.minutes,
      0,
    )
    expect(total).toBeLessThanOrEqual(30)

    const seenScreens = new Set<string>()
    for (let step = 0; step < 220; step += 1) {
      const heading = await page
        .locator('main p, main h1, main h2')
        .first()
        .innerText()
        .catch(() => '')
      if (heading) seenScreens.add(heading.slice(0, 30))
      const state = await advance(page)
      if (state === 'finished') break
    }

    await expect(
      page.getByRole('heading', { name: '今日のトレーニングが終わりました' }),
    ).toBeVisible({ timeout: 30_000 })

    // セッション結果には Skill Profile とフィードバックが出る
    await expect(page.getByText('Skill Profile')).toBeVisible()
    await expect(page.getByText(/次回の目標速度を/)).toBeVisible()

    const stored = await page.evaluate(() => ({
      results: JSON.parse(window.localStorage.getItem('srl:v1:results') ?? '[]'),
      recallTasks: JSON.parse(window.localStorage.getItem('srl:v1:recall_tasks') ?? '[]'),
    }))

    const savedTypes = stored.results.map((r: { trainingType: string }) => r.trainingType)
    for (const core of [
      'warmup',
      'speed_push',
      'structure_reading',
      'comprehension',
      'immediate_recall',
    ]) {
      expect(savedTypes).toContain(core)
    }
    expect(savedTypes).toContain('meaning_flash')
    expect(savedTypes).toContain('prediction_reading')
    expect(savedTypes).toContain('variable_speed')
    expect(savedTypes).toContain('immediate_recall')

    // 新トレーニングは accuracyScore として記録されている
    const flash = stored.results.filter(
      (r: { trainingType: string; accuracyScore: number | null }) =>
        r.trainingType === 'meaning_flash' && r.accuracyScore !== null,
    )
    expect(flash.length).toBeGreaterThan(3)

    // 翌日 Recall が予約されている
    expect(stored.recallTasks.length).toBeGreaterThan(0)

    // Dashboard に Skill Profile が主要指標として出る
    await page.getByRole('link', { name: 'Dashboard へ' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByText('Skill Profile')).toBeVisible()
    await expect(page.getByText(/を測定済み。弱い順に並べています/)).toBeVisible()
  })
})

test('新しいトレーニングが単体でも起動する', async ({ page }) => {
  for (const [type, marker] of [
    ['meaning_flash', '意味を取り出す'],
    ['prediction_reading', '途中で本文が止まります'],
    ['variable_speed', '段落ごとに読む速度を自分で切り替えます'],
    ['regression_control', '戻ることは禁止しません'],
  ] as const) {
    await page.goto(`/training/${type}`)
    await expect(page.getByText(marker)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  }
})
