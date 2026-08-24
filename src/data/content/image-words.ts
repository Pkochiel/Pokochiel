import { seededShuffle } from '@/core/util/seeded-shuffle'
import { IMAGE_MEMORY } from '@/core/training/btr/image-memory'

/**
 * イメージ記憶で使う語。
 *
 * 隣り合う語を結ぶ具体的なイメージを作って覚える種目なので、
 * 語はすべて **目に見えるもの** にする。
 * 「自由」「関係」のような抽象語が混ざると、イメージを作る手が止まって
 * 語彙の差が成績の差になってしまう。
 *
 * 意味のつながりが強い語（「机」と「椅子」など）が隣り合うと勝手に結びついて
 * 難度が下がるので、選ぶ側で分野を散らす。
 *
 * **語はすべて4文字以下にする。** シートは1語を1列に縦書きで並べるので、
 * 長い語が混ざるとその列だけ背が伸びて、下に続く解答欄の高さが揃わない。
 */

/** 1語の長さの上限。シートの1列に収まる字数。 */
export const IMAGE_WORD_MAX_LENGTH = 4

/** 分野ごとの語。ここから散らして取り出す。 */
const WORD_GROUPS: readonly (readonly string[])[] = [
  // 台所
  ['やかん', 'まな板', 'おたま', '茶碗', '冷蔵庫', 'しゃもじ', '水筒', 'ざる'],
  // 道具
  ['はしご', 'かなづち', '虫めがね', 'ほうき', 'のこぎり', 'じょうろ', '定規', '懐中電灯'],
  // 動物
  ['きりん', 'かえる', 'ふくろう', 'らくだ', 'いるか', 'こうもり', 'ペンギン', 'あひる'],
  // 食べ物
  ['すいか', 'たまご', 'ようかん', 'かぼちゃ', 'ドーナツ', 'たこ焼き', '栗', 'いちご'],
  // 外にあるもの
  ['信号機', '歩道橋', '風車', 'つり橋', '灯台', 'ベンチ', '噴水', '鳥居'],
  // 身につけるもの
  ['手袋', '長ぐつ', '眼鏡', 'マフラー', '腕時計', '帽子', 'エプロン', 'リュック'],
  // 乗りもの
  ['消防車', '気球', '自転車', '潜水艦', 'そり', 'タクシー', 'いかだ', 'ヨット'],
  // 家のなか
  ['階段', '本棚', '風呂おけ', 'カーテン', '座布団', '花びん', '洗面台', '傘立て'],
  // 自然
  ['たき', '洞くつ', '砂丘', '氷山', '切り株', 'たけのこ', 'つらら', '流れ星'],
  // 楽器・遊び
  ['たいこ', 'こま', '風船', 'けん玉', '木琴', 'たこ', 'ブランコ', 'めんこ'],
]

export const IMAGE_WORDS: readonly string[] = WORD_GROUPS.flat()

/**
 * その回に使う語を選ぶ。
 *
 * 分野ごとに順番に取り、同じ分野の語が固まらないようにする。
 * 固まると連想でつながってしまい、1語ずつイメージを作る訓練にならない。
 */
export function pickImageWords(
  seed: string,
  count: number = IMAGE_MEMORY.wordCount,
): string[] {
  if (count <= 0) return []

  // 分野ごとに中身をばらし、分野の順序もばらす。
  const shuffledGroups = seededShuffle(
    WORD_GROUPS.map((group, index) => seededShuffle(group, `${seed}:group:${index}`)),
    `${seed}:groups`,
  )

  // 分野をまたいで1語ずつ拾う。
  const picked: string[] = []
  for (let round = 0; picked.length < count; round += 1) {
    let addedThisRound = 0
    for (const group of shuffledGroups) {
      if (picked.length >= count) break
      const word = group[round]
      if (word === undefined) continue
      picked.push(word)
      addedThisRound += 1
    }
    // どの分野も尽きたら、語が足りていなくても止める（無限に回らないように）。
    if (addedThisRound === 0) break
  }

  return picked
}
