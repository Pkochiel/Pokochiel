import { CHUNKING } from '../config/training-config'
import type { ChunkLevel } from '../types/common'

/**
 * 日本語のチャンク分割。
 *
 * 教材の `chunks` は著者が定めた意味単位であり、これを分割の「原子」として扱う。
 * レベルは、原子をいくつ束ねて見せるかで決まる。原子の内部は原則として割らない。
 * 窓に収まらない長い原子だけ、助詞・句読点の境界を探して割る。
 *
 * 形態素解析器は導入しない（辞書が重く、MVP に見合わない）。
 * 将来 AI や解析器へ差し替える場合も、この関数の入出力は変わらない。
 */

/** 文節の切れ目になりやすい助詞・記号。長い原子を割るときの候補位置。 */
const BOUNDARY_MARKERS = [
  '、',
  '。',
  '，',
  '．',
  'は',
  'が',
  'を',
  'に',
  'で',
  'と',
  'へ',
  'から',
  'まで',
  'より',
  'ので',
  'ため',
  'ても',
  'ながら',
] as const

function findSplitPoint(text: string, maxChars: number): number {
  const limit = Math.min(maxChars, text.length - 1)
  for (let i = limit; i > 0; i -= 1) {
    for (const marker of BOUNDARY_MARKERS) {
      const end = i + 1
      if (end <= text.length && text.slice(end - marker.length, end) === marker) {
        return end
      }
    }
  }
  // 境界が見つからなければ窓の位置で割る（最後の手段）
  return limit > 0 ? limit : text.length
}

/** 窓に収まらない原子を、助詞・句読点の境界で分割する。 */
export function splitLongUnit(text: string, maxChars: number): string[] {
  if (maxChars <= 0 || text.length <= maxChars) return [text]
  const parts: string[] = []
  let rest = text
  while (rest.length > maxChars) {
    const at = findSplitPoint(rest, maxChars)
    parts.push(rest.slice(0, at))
    rest = rest.slice(at)
  }
  if (rest.length > 0) parts.push(rest)
  return parts
}

export interface ChunkGroup {
  text: string
  /** この表示に含まれる原子の数 */
  unitCount: number
  characterCount: number
}

function toGroup(units: readonly string[]): ChunkGroup {
  const text = units.join('')
  return { text, unitCount: units.length, characterCount: text.length }
}

/**
 * レベルに応じて原子をグループ化する。
 * Level 1–3 は文字数の窓、Level 4–5 は意味単位の個数で決まる。
 */
export function buildChunkGroups(atoms: readonly string[], level: ChunkLevel): ChunkGroup[] {
  const source = atoms.filter((a) => a.length > 0)
  if (source.length === 0) return []

  const config = CHUNKING.levels[level]

  if (config.kind === 'units') {
    const groups: ChunkGroup[] = []
    for (let i = 0; i < source.length; i += config.unitsPerChunk) {
      groups.push(toGroup(source.slice(i, i + config.unitsPerChunk)))
    }
    return groups
  }

  const { minChars, maxChars } = config
  // 窓を超える原子は先に分割しておく
  const units = source.flatMap((atom) => splitLongUnit(atom, maxChars))

  const groups: ChunkGroup[] = []
  let current: string[] = []
  let currentLength = 0

  for (const unit of units) {
    const wouldExceed = currentLength + unit.length > maxChars
    if (current.length > 0 && wouldExceed) {
      groups.push(toGroup(current))
      current = []
      currentLength = 0
    }
    current.push(unit)
    currentLength += unit.length
  }
  if (current.length > 0) groups.push(toGroup(current))

  // 末尾が極端に短い場合だけ、直前のグループに寄せる（1文字だけ残るのを防ぐ）。
  // ただし窓を超えるなら寄せない。表示時間の上限を守るほうを優先する。
  const last = groups[groups.length - 1]
  const previous = groups[groups.length - 2]
  if (
    groups.length >= 2 &&
    last &&
    previous &&
    last.characterCount < minChars / 2 &&
    previous.characterCount + last.characterCount <= maxChars
  ) {
    groups.splice(groups.length - 2, 2, {
      text: previous.text + last.text,
      unitCount: previous.unitCount + last.unitCount,
      characterCount: previous.characterCount + last.characterCount,
    })
  }

  return groups
}

/**
 * チャンクの表示時間。
 * 下限 250ms は光感受性発作のリスク帯（毎秒3回超の明滅）を避けるための安全弁であり、
 * 目標速度が上がっても下回らせない。
 */
export function chunkDisplayMs(characterCount: number, targetCpm: number): number {
  if (targetCpm <= 0) return CHUNKING.maxDisplayMs
  const charsPerSecond = targetCpm / 60
  const rawMs = (characterCount / charsPerSecond) * 1000
  return Math.min(CHUNKING.maxDisplayMs, Math.max(CHUNKING.minDisplayMs, Math.round(rawMs)))
}

/** 直近の正答率からチャンクレベルを上げ下げする。 */
export function adaptChunkLevel(current: ChunkLevel, accuracy: number): ChunkLevel {
  if (accuracy >= CHUNKING.levelUpAccuracy) return Math.min(5, current + 1) as ChunkLevel
  if (accuracy < CHUNKING.levelDownAccuracy) return Math.max(1, current - 1) as ChunkLevel
  return current
}
