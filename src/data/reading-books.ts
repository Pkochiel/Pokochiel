import { z } from 'zod'
import { PACED_READING, type ReadingBook } from '@/core/training/btr/paced-reading'
import { createBrowserStorage, type KeyValueStorage } from './persistence/key-value-storage'

/**
 * 読書で使う本の控え。
 *
 * 普通読書・倍速読書は自分の本を読む種目で、ページ数から字数を出すために
 * **1ページあたりの文字数**が要る。これを毎回入れさせるわけにはいかないので、
 * 本の名前と一緒に覚えておき、本が変わったときだけ登録し直してもらう。
 *
 * トレーニングの記録ではなく設定にあたるので、記録用の RecordStore ではなく
 * 単独の鍵で持つ。控えを失っても困るのは入力の手間だけで、記録そのものは
 * 本の名前と1ページの文字数を写して持つため、成績は失われない。
 */

const STORAGE_KEY = 'srl.reading-books.v1'

/** 控えとして持つ本の数。増えつづけないように上限を置く。 */
const MAX_BOOKS = 20

const bookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  charsPerPage: z.number().int().min(PACED_READING.minCharsPerPage).max(PACED_READING.maxCharsPerPage),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
})

const shelfSchema = z.object({
  books: z.array(bookSchema).default([]),
  currentId: z.string().nullable().default(null),
})

export interface ReadingShelf {
  /** 新しく登録したものが先頭。 */
  readonly books: readonly ReadingBook[]
  readonly currentId: string | null
}

const EMPTY: ReadingShelf = { books: [], currentId: null }

export interface ReadingBookShelfDeps {
  readonly storage: KeyValueStorage
  readonly now: () => Date
  readonly createId: () => string
}

export interface RegisterBookInput {
  readonly title: string
  readonly charsPerPage: number
}

export class ReadingBookShelf {
  constructor(private readonly deps: ReadingBookShelfDeps) {}

  /**
   * 控えを読む。
   *
   * 壊れた中身は空として扱う。読書を始められないほうが、
   * 前に登録した本を失うより困る。
   */
  load(): ReadingShelf {
    const raw = this.deps.storage.getItem(STORAGE_KEY)
    if (raw === null) return EMPTY

    try {
      const parsed = shelfSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) return EMPTY
      const books = parsed.data.books.slice(0, MAX_BOOKS)
      const currentId =
        parsed.data.currentId !== null &&
        books.some((book) => book.id === parsed.data.currentId)
          ? parsed.data.currentId
          : null
      return { books, currentId }
    } catch {
      return EMPTY
    }
  }

  /** いま読んでいる本。選ばれていなければ null。 */
  current(): ReadingBook | null {
    const shelf = this.load()
    return shelf.books.find((book) => book.id === shelf.currentId) ?? null
  }

  /**
   * 本を登録して、それを読む本にする。
   *
   * 同じ名前の本をもう一度登録したら、上書きせずに新しく作る。
   * 版が変わって1ページの文字数が違うことがあり、
   * 過去の記録の分母を後から書き換えてしまうため。
   */
  register(input: RegisterBookInput): ReadingBook {
    const book: ReadingBook = {
      id: this.deps.createId(),
      title: input.title.trim(),
      charsPerPage: Math.round(input.charsPerPage),
      createdAt: this.deps.now().toISOString(),
      finishedAt: null,
    }

    const parsed = bookSchema.safeParse(book)
    if (!parsed.success) {
      throw new Error(`本として受け付けられない値です: ${parsed.error.issues[0]?.message ?? ''}`)
    }

    const shelf = this.load()
    this.save({
      books: [book, ...shelf.books].slice(0, MAX_BOOKS),
      currentId: book.id,
    })
    return book
  }

  /** 控えの中から読む本を選び直す。 */
  select(id: string): void {
    const shelf = this.load()
    if (!shelf.books.some((book) => book.id === id)) return
    this.save({ books: shelf.books, currentId: id })
  }

  /** 読み切った印をつける。選ばれていた本なら選択を外す。 */
  finish(id: string): void {
    const shelf = this.load()
    if (!shelf.books.some((book) => book.id === id)) return
    const finishedAt = this.deps.now().toISOString()
    this.save({
      books: shelf.books.map((book) => (book.id === id ? { ...book, finishedAt } : book)),
      currentId: shelf.currentId === id ? null : shelf.currentId,
    })
  }

  private save(shelf: ReadingShelf): void {
    this.deps.storage.setItem(STORAGE_KEY, JSON.stringify(shelf))
  }
}

let instance: ReadingBookShelf | null = null

export function getReadingBookShelf(): ReadingBookShelf {
  instance ??= new ReadingBookShelf({
    storage: createBrowserStorage(),
    now: () => new Date(),
    createId: () => globalThis.crypto.randomUUID(),
  })
  return instance
}

/** テスト・開発用に差し替える。 */
export function setReadingBookShelf(shelf: ReadingBookShelf | null): void {
  instance = shelf
}
