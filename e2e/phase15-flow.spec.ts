import { expect, test, type Page } from '@playwright/test'
import { readCollection, waitForRecords } from './helpers/storage'

interface StoredPlan {
  blocks: { type: string; minutes: number }[]
}

/**
 * Phase 1.5 の通し確認。
 *
 * Baseline → Daily Training（Meaning Flash / Prediction Reading を含む）
 * → Recall → Dashboard までを1本で通す。
 *
 * 1セッションに入る任意ブロックは 2 つまで（PLAN.optionalBlockCount）。
 * どの 2 つが選ばれるかは「弱い順 → スコアの低い順」で決まるため、
 * 日付による回転に左右されないよう、スコアに差をつけて仕込む。
 */
const WEAK_SKILL_SEED = {
  meaning_flash: 10,
  prediction_reading: 15,
  // 3番目。上の2つより高いスコアにして、上限2ブロックから確実に外す。
  variable_speed: 40,
} as const

/** そのセッションに必ず入る任意ブロック（スコアの低い順に2つ）。 */
const EXPECTED_OPTIONAL = ['meaning_flash', 'prediction_reading'] as const

/** 任意ブロックの候補すべて。プランに入った任意ブロックを数えるために使う。 */
const ALL_OPTIONAL: string[] = [
  'meaning_flash',
  'chunk_reading',
  'prediction_reading',
  'variable_speed',
  'regression_control',
]

/**
 * 「読み終えた」を押すまでの待ち時間。
 *
 * 教材は 255〜888 字で、必要な待ち時間は教材ごとに違う
 * （3,000 CPM の妥当性上限に対し 5.1〜17.8 秒）。
 * 一方でペーサーは目標速度で勝手に読了へ進むため、長く待つとボタンが消える。
 * ここは「セッションが最後まで通ること」を見るテストなので、
 * どの教材でもボタンが残っている短い時間で押す。
 * CPM が valid かどうかはこのテストの対象ではない（core/metrics/cpm の unit test で見る）。
 */
const READING_DWELL_MS = 5000

async function seedWeakProfile(page: Page) {
  await page.addInitScript((seed: Record<string, number>) => {
    const types = Object.keys(seed)
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
            accuracyScore: seed[type] ?? 20,
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
 * 「見えているか」を確かめてから操作するまでの間に画面が進むことがある。
 * そのときは待ち続けず、次の周回で今の画面を見直す。
 */
const ACTION_TIMEOUT_MS = 5000

/**
 * 画面に出ているものを見て次の操作を決めるウォーカー。
 * 構成はプラン生成に依存して変わるため、ブロックの並びを決め打ちしない。
 */
async function advance(page: Page): Promise<'continue' | 'finished'> {
  const isVisible = async (locator: ReturnType<Page['getByRole']>) =>
    await locator.first().isVisible().catch(() => false)

  /** 画面が進んでいて操作できなければ、そのまま次の周回に任せる。 */
  const act = async (run: () => Promise<void>): Promise<'continue'> => {
    await run().catch(() => undefined)
    return 'continue'
  }

  if (await isVisible(page.getByRole('heading', { name: '今日のトレーニングが終わりました' }))) {
    return 'finished'
  }

  const continueButton = page.getByRole('button', { name: /^続ける$|^結果を見る$/ })
  if (await isVisible(continueButton)) {
    return act(() => continueButton.first().click({ timeout: ACTION_TIMEOUT_MS }))
  }

  const start = page.getByRole('button', { name: 'Start' })
  if (await isVisible(start)) {
    return act(() => start.first().click({ timeout: ACTION_TIMEOUT_MS }))
  }

  const predict = page.getByRole('button', { name: '予測する' })
  if (await isVisible(predict)) {
    return act(() => predict.first().click({ timeout: ACTION_TIMEOUT_MS }))
  }

  const finishedReading = page.getByRole('button', { name: '読み終えた' })
  if (await isVisible(finishedReading)) {
    await page.waitForTimeout(READING_DWELL_MS)
    return act(() => finishedReading.first().click({ timeout: ACTION_TIMEOUT_MS }))
  }

  const skipSegment = page.getByRole('button', { name: 'この区間を読み終えた' })
  if (await isVisible(skipSegment)) {
    return act(() => skipSegment.first().click({ timeout: ACTION_TIMEOUT_MS }))
  }

  // Immediate Recall: 記述 → Key Point 照合 → 自己評価
  const recallHeading = page.getByRole('heading', {
    name: '思い出せていた項目を選んでください',
  })
  if (await isVisible(recallHeading)) {
    const keyPoints = page.getByRole('listitem').filter({ has: page.getByRole('button') })
    return act(async () => {
      await keyPoints.nth(0).getByRole('button').click({ timeout: ACTION_TIMEOUT_MS })
      await page.getByRole('button', { name: '75%' }).click({ timeout: ACTION_TIMEOUT_MS })
      await page.getByRole('button', { name: '次へ' }).click({ timeout: ACTION_TIMEOUT_MS })
    })
  }

  const commitRecall = page.getByRole('button', { name: '入力を確定する' })
  if (await isVisible(commitRecall)) {
    return act(async () => {
      await page
        .getByRole('textbox')
        .fill('主張と根拠と結論をそれぞれ一行で', { timeout: ACTION_TIMEOUT_MS })
      await commitRecall.click({ timeout: ACTION_TIMEOUT_MS })
    })
  }

  const nextButtons = page.getByRole('button', { name: /^次へ$|^次の段落へ$|^結果へ$|^次の停止位置へ$/ })
  if (await isVisible(nextButtons)) {
    return act(() => nextButtons.first().click({ timeout: ACTION_TIMEOUT_MS }))
  }

  // 設問・選択肢
  const choice = page.getByRole('listitem').filter({ has: page.getByRole('button') })
  if ((await choice.count()) > 0) {
    return act(() => choice.first().getByRole('button').click({ timeout: ACTION_TIMEOUT_MS }))
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
    const plan = await waitForRecords<StoredPlan>(page, 'plans', 1, 30_000)
    const types: string[] = plan[0]!.blocks.map((b) => b.type)

    // 任意ブロックは1日2つまで。弱い順に選ばれるので中身も決まっている。
    const optional = types.filter((t) => ALL_OPTIONAL.includes(t))
    expect(optional).toEqual([...EXPECTED_OPTIONAL])

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
    const total = plan[0]!.blocks.reduce((sum, b) => sum + b.minutes, 0)
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

    const stored = {
      results: await readCollection<{
        trainingType: string
        sessionId: string
        accuracyScore: number | null
      }>(page, 'results'),
      recallTasks: await readCollection(page, 'recallTasks'),
    }

    // 仕込んだ過去実績（s0–s2）は除き、今回のセッションで保存された分だけを見る
    const seededSessionIds = ['s0', 's1', 's2']
    const savedTypes = stored.results
      .filter((r) => !seededSessionIds.includes(r.sessionId))
      .map((r) => r.trainingType)
    for (const core of [
      'warmup',
      'speed_push',
      'structure_reading',
      'comprehension',
      'immediate_recall',
    ]) {
      expect(savedTypes).toContain(core)
    }
    for (const type of EXPECTED_OPTIONAL) expect(savedTypes).toContain(type)
    expect(savedTypes).toContain('immediate_recall')

    // プランに入らなかった任意ブロックは実施されない（1日2つまで）
    expect(savedTypes).not.toContain('variable_speed')

    // 新トレーニングは accuracyScore として記録されている（1ブロックにつき1件）
    for (const type of EXPECTED_OPTIONAL) {
      const scored = stored.results.filter(
        (r) =>
          !seededSessionIds.includes(r.sessionId) &&
          r.trainingType === type &&
          r.accuracyScore !== null,
      )
      expect(scored).toHaveLength(1)
    }

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
