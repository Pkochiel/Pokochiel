import type { Page } from '@playwright/test'

const DATABASE_NAME = 'speed-reading-lab'

export const COLLECTIONS = [
  'profile',
  'sessions',
  'results',
  'readingTests',
  'recallTasks',
  'plans',
] as const

export type Collection = (typeof COLLECTIONS)[number]

type Row = Record<string, unknown>

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * 記録を時系列に並べる。
 *
 * IndexedDB の getAll() は id 順で返すため、そのままではアプリが
 * Repository 越しに見る順序（createdAt 昇順）と一致しない。
 */
function chronologically<T>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const left = a as Row
    const right = b as Row
    return (
      text(left.createdAt).localeCompare(text(right.createdAt)) ||
      text(left.id).localeCompare(text(right.id))
    )
  })
}

/**
 * 保存された記録を IndexedDB から直接読み出す。
 *
 * 保存先を直接のぞくのはテストだけ。アプリ側は Repository 経由でしか触らない
 * （その境界は src/data/__tests__/persistence-encapsulation.test.ts で固定している）。
 */
export async function readCollection<T = Row>(page: Page, collection: Collection): Promise<T[]> {
  return page.evaluate(
    ({ database, store, stores }) =>
      new Promise<T[]>((resolve, reject) => {
        // アプリと同じバージョン・同じ object store で開く。
        // テスト側が先に開いて「空の DB」を作ってしまうと、アプリ側の
        // onupgradeneeded が二度と走らなくなるため。
        const request = indexedDB.open(database, 1)
        request.onupgradeneeded = () => {
          for (const name of stores) {
            if (!request.result.objectStoreNames.contains(name)) {
              request.result.createObjectStore(name, { keyPath: 'id' })
            }
          }
        }
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(store)) {
            db.close()
            resolve([])
            return
          }
          const all = db.transaction(store, 'readonly').objectStore(store).getAll()
          all.onsuccess = () => {
            resolve(all.result as T[])
            db.close()
          }
          all.onerror = () => {
            reject(all.error)
            db.close()
          }
        }
      }),
    { database: DATABASE_NAME, store: collection, stores: [...COLLECTIONS] },
  ).then(chronologically)
}

export async function readProfile<T = Row>(page: Page): Promise<T | null> {
  const rows = await readCollection<T>(page, 'profile')
  return rows[0] ?? null
}

/** 非同期の保存が終わるまで待つ。 */
export async function waitForRecords<T = Row>(
  page: Page,
  collection: Collection,
  minimum = 1,
  timeoutMs = 15_000,
): Promise<T[]> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const rows = await readCollection<T>(page, collection)
    if (rows.length >= minimum) return rows
    if (Date.now() > deadline) {
      throw new Error(`${collection} に ${minimum} 件たまりませんでした（${rows.length} 件）`)
    }
    await page.waitForTimeout(150)
  }
}

/** 保存済みデータを空にする（DB 自体は消さない。開いている接続を止めないため）。 */
export async function clearStoredData(page: Page): Promise<void> {
  await page.evaluate(
    ({ database, stores }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(database, 1)
        request.onupgradeneeded = () => {
          for (const name of stores) {
            if (!request.result.objectStoreNames.contains(name)) {
              request.result.createObjectStore(name, { keyPath: 'id' })
            }
          }
        }
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const present = stores.filter((name) => db.objectStoreNames.contains(name))
          if (present.length === 0) {
            db.close()
            resolve()
            return
          }
          const tx = db.transaction(present, 'readwrite')
          for (const name of present) tx.objectStore(name).clear()
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
      }),
    { database: DATABASE_NAME, stores: [...COLLECTIONS] },
  )
}

/**
 * 条件を満たす Profile が保存されるまで待つ。
 *
 * 保存は非同期なので、画面遷移の前に「書き終わったこと」を確かめる必要がある
 * （遷移でページが破棄されると、確定前の書き込みは失われる）。
 */
export async function waitForProfile<T = Row>(
  page: Page,
  predicate: (profile: T) => boolean,
  timeoutMs = 15_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const profile = await readProfile<T>(page)
    if (profile && predicate(profile)) return profile
    if (Date.now() > deadline) throw new Error('Profile が期待した状態になりませんでした')
    await page.waitForTimeout(150)
  }
}

/** Service Worker が起動してページを制御する（＝オフラインで配信できる）まで待つ。 */
export async function waitForServiceWorker(page: Page): Promise<void> {
  const controlled = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    await navigator.serviceWorker.ready
    const deadline = Date.now() + 20_000
    while (!navigator.serviceWorker.controller && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return Boolean(navigator.serviceWorker.controller)
  })
  if (!controlled) throw new Error('Service Worker がページを制御しませんでした')
}
