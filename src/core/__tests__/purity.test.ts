import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CORE_DIR = fileURLToPath(new URL('..', import.meta.url))

/**
 * core/ は純粋ドメイン層であり、React / Next / DOM / 現在時刻に依存してはならない。
 * （docs/ARCHITECTURE.md §2 の依存ルールをテストで固定する）
 */
const FORBIDDEN: { pattern: RegExp; reason: string }[] = [
  { pattern: /from\s+['"]react['"]/, reason: 'React に依存している' },
  { pattern: /from\s+['"]react-dom/, reason: 'react-dom に依存している' },
  { pattern: /from\s+['"]next[/'"]/, reason: 'Next.js に依存している' },
  { pattern: /from\s+['"]@\/(features|app|components)\b/, reason: 'UI レイヤを参照している' },
  { pattern: /\bwindow\./, reason: 'window を参照している' },
  { pattern: /\bdocument\./, reason: 'document を参照している' },
  { pattern: /\blocalStorage\b/, reason: 'localStorage を参照している' },
  { pattern: /\bDate\.now\(/, reason: '現在時刻を内部で取得している（引数で受け取ること）' },
  { pattern: /\bnew Date\(\s*\)/, reason: '現在時刻を内部で取得している（引数で受け取ること）' },
  { pattern: /\bperformance\.now\(/, reason: '計測 API に依存している' },
]

/**
 * コメントを除いたコードだけを検査対象にする。
 * 「performance.now() は呼び出し側の責務」のような説明を書けなくなると、
 * 純粋性の意図そのものが文書化できなくなるため。
 */
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
    if (!path.endsWith('.ts') || path.endsWith('.test.ts')) return []
    return [path]
  })
}

describe('core layer purity', () => {
  const files = collectSourceFiles(CORE_DIR)

  it('検査対象のファイルが存在する', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s は UI・DOM・現在時刻に依存しない', (file) => {
    const source = stripComments(readFileSync(file, 'utf8'))
    const violations = FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map(
      ({ reason }) => reason,
    )
    expect(violations).toEqual([])
  })
})
