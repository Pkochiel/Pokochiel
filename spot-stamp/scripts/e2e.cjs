// モバイル画面での E2E 動作確認: node scripts/e2e.cjs http://localhost:8787 [screenshotDir]
const { chromium, devices } = require('playwright');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:8787';
const OUT = process.argv[3] || path.join(__dirname, '..', 'e2e-shots');

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], geolocation: { latitude: 36.6227, longitude: 138.5964 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/tile|Failed to load resource|nominatim/i.test(m.text()) && errors.push(m.text()));
  const room = `e2e-${Date.now().toString(36)}`;
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

  await page.goto(`${BASE}/?room=${room}`);
  await page.waitForTimeout(1500);
  await shot('01-opening');
  await page.locator('.opening').click();
  await page.getByPlaceholder('ニックネーム').fill('湯けむり太郎');
  await page.getByRole('button', { name: 'はじめる' }).click();

  // スポット追加
  await page.getByRole('button', { name: 'スポットを追加' }).click();
  await page.getByPlaceholder('例：〇〇温泉').fill('草津温泉 湯畑');
  await page.locator('.cat-picker__item', { hasText: '温泉' }).click();
  await page.locator('input[type=file]').setInputFiles(path.join(__dirname, 'fixture.png'));
  await page.waitForSelector('.photo-picker__preview img');
  await page.getByPlaceholder('ここが最高').fill('湯畑の夜景が最高！');
  await shot('02-form');
  await page.getByRole('button', { name: 'この場所を登録する' }).click();
  await page.waitForSelector('.spot-card');
  await page.waitForFunction(() => !document.querySelector('.chip--pending'), null, { timeout: 10000 });
  await shot('03-card');

  // スタンプ
  await page.getByRole('button', { name: /行った！/ }).click();
  await page.waitForSelector('.ceremony--impact', { timeout: 5000 });
  await page.waitForTimeout(150);
  await shot('04-impact');
  await page.waitForSelector('.ceremony__get');
  await page.waitForTimeout(700);
  await shot('05-reveal');
  const onsite = await page.locator('.ceremony__onsite').count();
  await page.getByRole('button', { name: /スタンプ帳を見る/ }).click();
  await page.waitForSelector('.book');
  await shot('06-book');

  // リロード後もスタンプが残る & サーバーに反映
  await page.reload();
  await page.locator('.opening').click();
  await page.getByRole('button', { name: /スタンプ帳/ }).click();
  const slots = await page.locator('.slot--got').count();
  const state = await (await fetch(`${BASE}/api/rooms/${room}/state`)).json();

  // 別の人として参加 → 共有されたスポットが見える
  const ctx2 = await browser.newContext({ ...devices['Pixel 7'] });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/?room=${room}`);
  await p2.locator('.opening').click();
  await p2.getByPlaceholder('ニックネーム').fill('はなこ');
  await p2.getByRole('button', { name: 'はじめる' }).click();
  await p2.waitForSelector('.pin', { timeout: 10000 });
  await p2.locator('.pin').first().click();
  await p2.waitForSelector('.spot-card');
  const visitorsText = await p2.locator('.spot-card__visitors').innerText();
  await p2.screenshot({ path: path.join(OUT, '07-shared.png') });
  await p2.getByRole('button', { name: 'グループ' }).click();
  await p2.screenshot({ path: path.join(OUT, '08-group.png') });

  const result = {
    onsite: onsite > 0,
    stampsAfterReload: slots,
    serverSpots: state.spots.length,
    serverHasPhoto: !!state.spots[0]?.photoUrl,
    serverVisits: Object.keys(state.visits).length,
    visitorsText,
    errors,
  };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (errors.length || slots !== 1 || state.spots.length !== 1 || !result.serverHasPhoto) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
