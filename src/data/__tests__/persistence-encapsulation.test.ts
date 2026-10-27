import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../..', import.meta.url))

/**
 * 保存技術（IndexedDB / localStorage）に固有の処理を、
 * UI・Core Domain・Repository へ漏らさないことを機械的に固定する。
 *
 * 漏れた瞬間に「保存先の差し替え」が UI の書き換えを伴う作業になるため、
 * レビューではなくテストで止める（docs/ARCHITECTURE.md §4）。
 */
const FORBIDDEN: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bindexedDB\b/i, reason: 'IndexedDB を直接参照している' },
  { pattern: /\bIDB[A-Z]\w*/, reason: 'IndexedDB の型を参照している' },
  { pattern: /\bobjectStore\b|\bcreateObjectStore\b/, reason: 'object store を直接操作している' },
  { pattern: /\blocalStorage\b/, reason: 'localStorage を直接参照している' },
  { pattern: /'srl:v\d/, reason: '保存キーを直接組み立てている' },
]

/**
 * persistence 層の内側では、IndexedDB の API 呼び出しだけを indexeddb/ に閉じる。
 * 保存先を選ぶ 1 箇所（create-store.ts）は技術名を知ってよいが、API は呼ばない。
 */
const INDEXEDDB_API = [
  { pattern: /\bobjectStore\b|\bcreateObjectStore\b/, reason: 'object store を操作している' },
  { pattern: /\bonupgradeneeded\b|\btransaction\(/, reason: 'IndexedDB の API を呼んでいる' },
  { pattern: /\bIDB(Database|Request|Transaction|ObjectStore|OpenDBRequest)\b/, reason: 'IndexedDB の実装型を参照している' },
]

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*')
    })
    .join('\n')
}

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' ? [] : collectSourceFiles(path)
    }
    if (!/\.tsx?$/.test(path) || /\.test\.tsx?$/.test(path)) return []
    return [path]
  })
}

function violationsIn(
  path: string,
  rules: { pattern: RegExp; reason: string }[] = FORBIDDEN,
): string[] {
  const source = stripComments(readFileSync(path, 'utf8'))
  return rules.filter(({ pattern }) => pattern.test(source)).map(({ reason }) => reason)
}

describe('保存技術の封じ込め', () => {
  const layers = ['core', 'features', 'app', 'components', 'lib'].flatMap((dir) =>
    collectSourceFiles(join(SRC, dir)),
  )

  it('検査対象のファイルが存在する', () => {
    expect(layers.length).toBeGreaterThan(0)
  })

  it.each(layers)('%s は保存技術に依存しない', (file) => {
    expect(violationsIn(file)).toEqual([])
  })

  const dataFiles = collectSourceFiles(join(SRC, 'data')).filter(
    (path) => !path.includes(join('persistence', '')),
  )

  it.each(dataFiles)('%s（Repository / 教材）は保存技術に依存しない', (file) => {
    expect(violationsIn(file)).toEqual([])
  })

  const persistenceFiles = collectSourceFiles(join(SRC, 'data', 'persistence')).filter(
    (path) => !path.includes(join('persistence', 'indexeddb')),
  )

  it.each(persistenceFiles)('%s は IndexedDB の API を直接呼ばない', (file) => {
    expect(violationsIn(file, INDEXEDDB_API)).toEqual([])
  })
})
