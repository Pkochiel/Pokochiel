/*
 * Speed Reading Lab — オフライン起動のための Service Worker。
 *
 * 方針:
 *  - 画面遷移はネットワーク優先、失敗したらキャッシュ（オフラインでも起動する）
 *  - ハッシュ付きの静的アセットはキャッシュ優先（同じ URL なら中身は変わらない）
 *  - 学習記録には触らない。データの永続化は IndexedDB 側の責務。
 *
 * VERSION を上げると古いキャッシュを破棄する。
 */
const VERSION = 'v1'
const SHELL_CACHE = `srl-shell-${VERSION}`
const ASSET_CACHE = `srl-asset-${VERSION}`
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

/**
 * 画面の HTML と、そこから参照される JS / CSS をまとめて取り込む。
 *
 * HTML だけを持っていてもチャンクが無ければオフラインでは動かない。
 * ファイル名にはハッシュが入るため、名前は HTML から実際に読み取る。
 */
async function precache() {
  const shell = await caches.open(SHELL_CACHE)
  const assets = await caches.open(ASSET_CACHE)
  const referenced = new Set()

  await Promise.allSettled(
    SHELL_ROUTES.map(async (route) => {
      const response = await fetch(route, { cache: 'reload' })
      if (!isCacheable(response)) return
      await shell.put(route, response.clone())
      for (const asset of findAssets(await response.text())) referenced.add(asset)
    }),
  )

  await Promise.allSettled([...referenced].map((url) => assets.add(url)))
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
        names.filter((name) => !CURRENT_CACHES.includes(name)).map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

/** 画面遷移: ネットワーク優先。落ちたらキャッシュ、最後は Dashboard を出す。 */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (isCacheable(response)) cache.put(request, response.clone())
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
    event.respondWith(handleNavigation(request))
    return
  }
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleAsset(request))
    return
  }
  event.respondWith(handleOther(request))
})
