/*
 * Speed Reading Lab — オフライン起動のための Service Worker。
 *
 * 方針:
 *  - 画面遷移はネットワーク優先、失敗したらキャッシュ（オフラインでも起動する）
 *  - ハッシュ付きの静的アセットはキャッシュ優先（同じ URL なら中身は変わらない）
 *  - 学習記録には触らない。データの永続化は IndexedDB 側の責務。
 *
 * 更新戦略:
 *  登録 URL の ?build= でキャッシュ名を分ける（/sw.js?build=<BUILD_ID>）。
 *  新しいビルドを配ると登録スクリプトの URL が変わるため install → activate が走り、
 *  activate で **このビルド以外の srl- キャッシュをすべて削除する**。
 *  古い JS / CSS が無期限に residue として残ることはない。
 *
 *  HTML と JS の不整合は次の 2 点で防ぐ:
 *   1. HTML はネットワーク優先（オンラインなら常に最新の HTML を見る）
 *   2. HTML をキャッシュに入れるとき、その HTML が参照する JS / CSS も併せて取り込む
 *  ファイル名にはハッシュが入るため、新しい HTML が古いチャンクを指すことはない。
 */
const BUILD = new URL(self.location.href).searchParams.get('build') || 'dev'
const CACHE_PREFIX = 'srl-'
const SHELL_CACHE = `${CACHE_PREFIX}shell-${BUILD}`
const ASSET_CACHE = `${CACHE_PREFIX}asset-${BUILD}`
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE]

const TRAINING_TYPES = [
  'warmup',
  'speed_push',
  'chunk_reading',
  'meaning_flash',
  'structure_reading',
  'prediction_reading',
  'variable_speed',
  'regression_control',
  'comprehension',
  'immediate_recall',
]

/** オフラインでも 1 日分のトレーニングを完走できる経路。 */
const SHELL_ROUTES = [
  '/',
  '/dashboard',
  '/training',
  '/progress',
  '/recall',
  '/settings',
  '/onboarding',
  '/baseline',
  '/baseline/read',
  ...TRAINING_TYPES.map((type) => `/training/${type}`),
]

const OFFLINE_FALLBACK = '/dashboard'

function isCacheable(response) {
  return response && response.ok && response.type === 'basic'
}

/** HTML から参照している静的アセットの URL を拾う。 */
function findAssets(html) {
  return new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) ?? [])
}

/** 未取得のアセットだけを取り込む。 */
async function cacheAssets(urls) {
  if (urls.size === 0) return
  const cache = await caches.open(ASSET_CACHE)
  await Promise.allSettled(
    [...urls].map(async (url) => {
      if (await cache.match(url)) return
      await cache.add(url)
    }),
  )
}

/** HTML と、その HTML が参照する JS / CSS を対にして保存する。 */
async function storeShell(request, response) {
  const shell = await caches.open(SHELL_CACHE)
  await shell.put(request, response.clone())
  await cacheAssets(findAssets(await response.text()))
}

/**
 * 主要画面をまとめて取り込む。
 * HTML だけではオフラインで画面が動かないため、参照先も一緒に入れる。
 */
async function precache() {
  await Promise.allSettled(
    SHELL_ROUTES.map(async (route) => {
      const response = await fetch(route, { cache: 'reload' })
      if (!isCacheable(response)) return
      await storeShell(route, response)
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // 1 つ失敗しても残りは入れる（起動できる状態を優先する）。
      await precache()
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

/** 画面遷移: ネットワーク優先。落ちたらキャッシュ、最後は Dashboard を出す。 */
async function handleNavigation(event, request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (isCacheable(response)) {
      // 応答を返したあとで、HTML と参照先アセットを対にして保存する
      event.waitUntil(storeShell(request, response.clone()))
    }
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    const fallback = await cache.match(OFFLINE_FALLBACK, { ignoreVary: true })
    if (fallback) return fallback
    throw error
  }
}

/** ハッシュ付きアセット: キャッシュ優先。 */
async function handleAsset(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (isCacheable(response)) cache.put(request, response.clone())
  return response
}

/** その他の同一オリジン GET: キャッシュを返しつつ裏で更新する。 */
async function handleOther(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (isCacheable(response)) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached ?? network
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event, request))
    return
  }
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleAsset(request))
    return
  }
  event.respondWith(handleOther(request))
})
