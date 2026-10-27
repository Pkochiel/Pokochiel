import { describe, expect, it } from 'vitest'
import type { RecordStore, StoredRecord } from './record-store'

interface Row extends StoredRecord {
  value: string
  nested?: { note: string }
}

const row = (id: string, value = id): Row => ({ id, value })

/**
 * RecordStore が満たすべき振る舞い。
 *
 * 実装（メモリ / localStorage / IndexedDB）が同じ契約を満たす限り、
 * Repository より上の層は保存先の違いを意識しなくてよい。
 * 保存先を増やすときは、このテストを通すことが受け入れ条件になる。
 */
export function describeRecordStoreContract(
  name: string,
  createStore: () => RecordStore | Promise<RecordStore>,
): void {
  describe(`RecordStore 契約: ${name}`, () => {
    it('空の collection は空配列を返す', async () => {
      const store = await createStore()
      expect(await store.list('results')).toEqual([])
      expect(await store.get('results', 'missing')).toBeNull()
    })

    it('保存したレコードを id で取り出せる', async () => {
      const store = await createStore()
      await store.put('sessions', row('s1'))
      expect(await store.get('sessions', 's1')).toMatchObject({ id: 's1', value: 's1' })
      expect(await store.list('sessions')).toHaveLength(1)
    })

    it('同じ id の保存は上書きになる', async () => {
      const store = await createStore()
      await store.put('sessions', row('s1', 'before'))
      await store.put('sessions', row('s1', 'after'))
      const rows = (await store.list('sessions')) as Row[]
      expect(rows).toHaveLength(1)
      expect(rows[0]?.value).toBe('after')
    })

    it('putMany でまとめて保存できる', async () => {
      const store = await createStore()
      await store.putMany('results', [row('r1'), row('r2'), row('r3')])
      const ids = ((await store.list('results')) as Row[]).map((r) => r.id).sort()
      expect(ids).toEqual(['r1', 'r2', 'r3'])
    })

    it('putMany に空配列を渡しても壊れない', async () => {
      const store = await createStore()
      await store.putMany('results', [])
      expect(await store.list('results')).toEqual([])
    })

    it('remove は指定した 1 件だけ消す', async () => {
      const store = await createStore()
      await store.putMany('plans', [row('p1'), row('p2')])
      await store.remove('plans', 'p1')
      const ids = ((await store.list('plans')) as Row[]).map((r) => r.id)
      expect(ids).toEqual(['p2'])
    })

    it('clear は対象の collection だけを空にする', async () => {
      const store = await createStore()
      await store.put('plans', row('p1'))
      await store.put('results', row('r1'))
      await store.clear('plans')
      expect(await store.list('plans')).toEqual([])
      expect(await store.list('results')).toHaveLength(1)
    })

    it('保存後に元のオブジェクトを書き換えても保存内容は変わらない', async () => {
      const store = await createStore()
      const original: Row = { id: 'x1', value: 'original', nested: { note: 'original' } }
      await store.put('recallTasks', original)
      original.value = 'mutated'
      if (original.nested) original.nested.note = 'mutated'

      const stored = (await store.get('recallTasks', 'x1')) as Row
      expect(stored.value).toBe('original')
      expect(stored.nested?.note).toBe('original')
    })

    it('profile のような単一レコードも同じ扱いで保存できる', async () => {
      const store = await createStore()
      await store.put('profile', row('local-user'))
      expect(await store.list('profile')).toHaveLength(1)
      await store.clear('profile')
      expect(await store.list('profile')).toEqual([])
    })
  })
}
