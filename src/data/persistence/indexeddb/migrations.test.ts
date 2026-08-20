import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { COLLECTIONS } from '../record-store'
import { IndexedDbRecordStore } from './indexeddb-store'
import {
  createCollection,
  DATABASE_VERSION,
  pendingMigrations,
  runMigrations,
  SCHEMA_MIGRATIONS,
  transformCollection,
  type MigrationContext,
  type SchemaMigration,
} from './migrations'

const noop = () => undefined

/** 保存層に直接書き込むための素の行。 */
const asRecord = (record: { id: string } & Record<string, unknown>) => record

const migration = (version: number, apply: (context: MigrationContext) => void = noop) =>
  ({ version, description: `test v${version}`, apply }) satisfies SchemaMigration

describe('pendingMigrations', () => {
  const all = [migration(1), migration(2), migration(3)]

  it('未適用のものだけを返す', () => {
    expect(pendingMigrations(all, 1, 3).map((m) => m.version)).toEqual([2, 3])
  })

  it('新規 DB（version 0）にはすべて適用する', () => {
    expect(pendingMigrations(all, 0, 3).map((m) => m.version)).toEqual([1, 2, 3])
  })

  it('最新まで適用済みなら何もしない', () => {
    expect(pendingMigrations(all, 3, 3)).toEqual([])
  })

  it('定義順が乱れていても version の昇順で適用する', () => {
    const shuffled = [migration(3), migration(1), migration(2)]
    expect(pendingMigrations(shuffled, 0, 3).map((m) => m.version)).toEqual([1, 2, 3])
  })

  it('目標 version を超える migration は適用しない', () => {
    expect(pendingMigrations(all, 0, 2).map((m) => m.version)).toEqual([1, 2])
  })
})

describe('runMigrations', () => {
  it('適用した内容を順に返す', () => {
    const order: number[] = []
    const list = [
      migration(1, () => order.push(1)),
      migration(2, () => order.push(2)),
      migration(3, () => order.push(3)),
    ]
    const context = {} as MigrationContext
    const applied = runMigrations(context, list, 1, 3)

    expect(order).toEqual([2, 3])
    expect(applied).toEqual(['v2: test v2', 'v3: test v3'])
  })
})

describe('出荷しているスキーマ', () => {
  it('version は migration の並びから導出される', () => {
    expect(DATABASE_VERSION).toBe(
      SCHEMA_MIGRATIONS.reduce((latest, m) => Math.max(latest, m.version), 1),
    )
  })

  it('version が重複していない（同じ version の二重適用を防ぐ）', () => {
    const versions = SCHEMA_MIGRATIONS.map((m) => m.version)
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('新規の端末では全 collection が作られる', async () => {
    const store = new IndexedDbRecordStore({ factory: new IDBFactory() })
    const database = await store.open()
    for (const collection of COLLECTIONS) {
      expect(database.objectStoreNames.contains(collection)).toBe(true)
    }
    expect(database.version).toBe(DATABASE_VERSION)
  })
})

describe('version を跨ぐ upgrade', () => {
  /** v1 まで進めた DB を作り、記録を入れておく。 */
  async function seedV1(factory: IDBFactory) {
    const store = new IndexedDbRecordStore({
      factory,
      migrations: [SCHEMA_MIGRATIONS[0]!],
    })
    await store.putMany('results', [
      asRecord({ id: 'r1', cpm: 700, legacyLabel: 'speed' }),
      asRecord({ id: 'r2', cpm: 640, legacyLabel: 'chunk' }),
    ])
    await store.put('profile', asRecord({ id: 'local-user', baselineCpm: 620 }))
    await store.close()
    return store
  }

  it('v1 → v2 で既存の記録を失わない', async () => {
    const factory = new IDBFactory()
    await seedV1(factory)

    const upgraded = new IndexedDbRecordStore({
      factory,
      migrations: [
        SCHEMA_MIGRATIONS[0]!,
        migration(2, (context) => createCollection(context, 'plans')),
      ],
    })
    const database = await upgraded.open()

    expect(database.version).toBe(2)
    expect(await upgraded.list('results')).toHaveLength(2)
    expect(await upgraded.get('profile', 'local-user')).toMatchObject({ baselineCpm: 620 })
  })

  it('migration で既存レコードのフィールドを移送できる', async () => {
    const factory = new IDBFactory()
    await seedV1(factory)

    const upgraded = new IndexedDbRecordStore({
      factory,
      migrations: [
        SCHEMA_MIGRATIONS[0]!,
        migration(2, (context) => {
          transformCollection(context, 'results', (record) => {
            const { legacyLabel, ...rest } = record
            return { ...rest, trainingType: legacyLabel ?? null }
          })
        }),
      ],
    })

    const rows = (await upgraded.list('results')) as { trainingType: string }[]
    expect(rows.map((r) => r.trainingType).sort()).toEqual(['chunk', 'speed'])
    expect(rows[0]).not.toHaveProperty('legacyLabel')
  })

  it('複数 version をまとめて適用できる（v1 の端末が v3 のアプリに出会う）', async () => {
    const factory = new IDBFactory()
    await seedV1(factory)

    const applied: number[] = []
    const upgraded = new IndexedDbRecordStore({
      factory,
      migrations: [
        SCHEMA_MIGRATIONS[0]!,
        migration(2, () => applied.push(2)),
        migration(3, () => applied.push(3)),
      ],
    })
    const database = await upgraded.open()

    expect(applied).toEqual([2, 3])
    expect(database.version).toBe(3)
    expect(await upgraded.list('results')).toHaveLength(2)
  })

  it('同じ version で開き直しても migration は再実行しない', async () => {
    const factory = new IDBFactory()
    const applied: number[] = []
    const migrations = [SCHEMA_MIGRATIONS[0]!, migration(2, () => applied.push(2))]

    const first = new IndexedDbRecordStore({ factory, migrations })
    await first.open()
    await first.close()

    const second = new IndexedDbRecordStore({ factory, migrations })
    await second.open()

    expect(applied).toEqual([2])
  })
})
