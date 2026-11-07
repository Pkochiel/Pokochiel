import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorage } from './persistence/key-value-storage'
import { ReadingBookShelf } from './reading-books'

const KEY = 'srl.reading-books.v1'

function createShelf() {
  const storage = new MemoryStorage()
  let id = 0
  let clock = Date.parse('2026-08-22T09:00:00.000Z')
  const shelf = new ReadingBookShelf({
    storage,
    now: () => new Date((clock += 60_000)),
    createId: () => `book-${(id += 1)}`,
  })
  return { shelf, storage }
}

describe('ReadingBookShelf', () => {
  let shelf: ReadingBookShelf
  let storage: MemoryStorage

  beforeEach(() => {
    ;({ shelf, storage } = createShelf())
  })

  it('何も登録していなければ空', () => {
    expect(shelf.load()).toEqual({ books: [], currentId: null })
    expect(shelf.current()).toBeNull()
  })

  it('登録するとその本が読む本になる', () => {
    const book = shelf.register({ title: '銀の匙', charsPerPage: 620 })
    expect(book.title).toBe('銀の匙')
    expect(book.charsPerPage).toBe(620)
    expect(book.finishedAt).toBeNull()
    expect(shelf.current()).toEqual(book)
  })

  it('新しく登録したものが先頭に来る', () => {
    shelf.register({ title: '一冊目', charsPerPage: 600 })
    shelf.register({ title: '二冊目', charsPerPage: 700 })
    expect(shelf.load().books.map((book) => book.title)).toEqual(['二冊目', '一冊目'])
  })

  it('別のたばでも読み出せる（保存されている）', () => {
    const book = shelf.register({ title: '銀の匙', charsPerPage: 620 })
    const other = new ReadingBookShelf({
      storage,
      now: () => new Date(),
      createId: () => 'x',
    })
    expect(other.current()).toEqual(book)
  })

  it('前後の空白を落とす', () => {
    expect(shelf.register({ title: '  銀の匙 ', charsPerPage: 620 }).title).toBe('銀の匙')
  })

  it('1ページの文字数は整数にする', () => {
    expect(shelf.register({ title: '本', charsPerPage: 619.6 }).charsPerPage).toBe(620)
  })

  it('桁の外れた1ページの文字数は受け付けない', () => {
    // 6文字や6万文字のページはない。入れば以後の分速が丸ごと壊れる。
    expect(() => shelf.register({ title: '本', charsPerPage: 6 })).toThrow()
    expect(() => shelf.register({ title: '本', charsPerPage: 60_000 })).toThrow()
    expect(shelf.load().books).toEqual([])
  })

  it('名前が空の本は受け付けない', () => {
    expect(() => shelf.register({ title: '   ', charsPerPage: 620 })).toThrow()
  })

  it('同じ名前でももう一度登録すれば別の本になる', () => {
    // 版が変わって1ページの文字数が違うことがある。上書きすると
    // 過去の記録の分母を後から書き換えてしまう。
    const first = shelf.register({ title: '銀の匙', charsPerPage: 620 })
    const second = shelf.register({ title: '銀の匙', charsPerPage: 840 })
    expect(second.id).not.toBe(first.id)
    expect(shelf.load().books).toHaveLength(2)
  })

  it('読む本を選び直せる', () => {
    const first = shelf.register({ title: '一冊目', charsPerPage: 600 })
    shelf.register({ title: '二冊目', charsPerPage: 700 })
    shelf.select(first.id)
    expect(shelf.current()?.title).toBe('一冊目')
  })

  it('控えにない本は選べない', () => {
    const book = shelf.register({ title: '一冊目', charsPerPage: 600 })
    shelf.select('どこにもない')
    expect(shelf.current()?.id).toBe(book.id)
  })

  it('読み切った印をつけると選択が外れる', () => {
    const book = shelf.register({ title: '一冊目', charsPerPage: 600 })
    shelf.finish(book.id)
    expect(shelf.current()).toBeNull()
    expect(shelf.load().books[0]!.finishedAt).not.toBeNull()
  })

  it('選んでいない本を読み切っても選択は変わらない', () => {
    const first = shelf.register({ title: '一冊目', charsPerPage: 600 })
    const second = shelf.register({ title: '二冊目', charsPerPage: 700 })
    shelf.finish(first.id)
    expect(shelf.current()?.id).toBe(second.id)
  })

  it('控えは上限で打ち切る', () => {
    for (let i = 0; i < 25; i += 1) shelf.register({ title: `本${i}`, charsPerPage: 600 })
    expect(shelf.load().books).toHaveLength(20)
    expect(shelf.load().books[0]!.title).toBe('本24')
  })

  it('壊れた中身は空として扱う', () => {
    // 読書を始められないほうが、前に登録した本を失うより困る。
    storage.setItem(KEY, '{ではない')
    expect(shelf.load()).toEqual({ books: [], currentId: null })

    storage.setItem(KEY, JSON.stringify({ books: [{ id: 'a' }], currentId: 'a' }))
    expect(shelf.load()).toEqual({ books: [], currentId: null })
  })

  it('控えにない本を指している選択は外す', () => {
    storage.setItem(KEY, JSON.stringify({ books: [], currentId: 'いない本' }))
    expect(shelf.load().currentId).toBeNull()
  })
})
