import { seededShuffle } from '@/core/util/seeded-shuffle'
import type { ChunkLevel } from '@/core/types'

/**
 * Meaning Flash の教材。
 *
 * 鍛えるのは「文字列を覚える力」ではなく「短い露出から意味を取り出す速度」。
 * そのため設問は本文の語句を問わず、必ず「言いたかったことは何か」を問う。
 * 誤答は、本文に出てきた語を使いながら意味がずれているものを含める
 * （語の記憶だけでは正解できないようにするため）。
 */
export interface MeaningFlashItemDraft {
  id: string
  level: ChunkLevel
  text: string
  answer: string
  distractors: [string, string, string]
  explanation: string
}

export interface MeaningFlashChoice {
  id: string
  text: string
}

export interface MeaningFlashItem {
  id: string
  level: ChunkLevel
  text: string
  characterCount: number
  prompt: string
  choices: MeaningFlashChoice[]
  correctChoiceId: string
  explanation: string
}

const PROMPT = 'この文章が言いたかったことは？'

const DRAFTS: MeaningFlashItemDraft[] = [
  // ---- Level 1: 短く具体的 ----
  {
    id: 'mf-1-01',
    level: 1,
    text: '会議の数を減らしても、決める人が決めなければ物事は進まない。',
    answer: '問題は会議の量ではなく、意思決定が行われないことにある',
    distractors: [
      '会議はできるだけ減らすべきである',
      '決める人を増やせば物事は進む',
      '会議の進め方を統一する必要がある',
    ],
    explanation: '「減らしても…進まない」という譲歩の形が、論点が量ではないことを示しています。',
  },
  {
    id: 'mf-1-02',
    level: 1,
    text: '手順書を作っただけでは現場は変わらない。読まれて初めて意味を持つ。',
    answer: '文書は作成ではなく、読まれることで効果を持つ',
    distractors: [
      '手順書は作るべきではない',
      '現場は文書より口頭の指示を好む',
      '手順書は短くまとめるべきである',
    ],
    explanation: '後半の「読まれて初めて」が、価値の所在を作成から利用へ移しています。',
  },
  {
    id: 'mf-1-03',
    level: 1,
    text: '安さで選ばれた顧客は、より安い相手が現れれば離れていく。',
    answer: '価格だけで獲得した顧客は定着しない',
    distractors: [
      '値下げは顧客獲得に有効である',
      '顧客は常に最安値を選ぶ',
      '価格競争は避けられない',
    ],
    explanation: '「離れていく」が結論であり、安さによる獲得の限界を述べています。',
  },
  {
    id: 'mf-1-04',
    level: 1,
    text: '毎日続けるより、途切れた翌日に戻れるかどうかが習慣を決める。',
    answer: '習慣の分かれ目は、途切れた後に再開できるかにある',
    distractors: [
      '習慣は毎日続けなければ意味がない',
      '習慣は一度途切れると失われる',
      '習慣は翌日に始めるのがよい',
    ],
    explanation: '「より」が比較を作り、重点が再開にあることを示しています。',
  },

  // ---- Level 2: 因果を含む ----
  {
    id: 'mf-2-01',
    level: 2,
    text: '各部門が個別にシステムを入れると、データは部門ごとに最適化され、全社の判断には使えなくなる。',
    answer: '部門単位の最適化が、全社で使えないデータを生む',
    distractors: [
      'システムの性能が足りないとデータは使えない',
      '全社共通のシステムは導入が難しい',
      '部門ごとの導入はコストが高い',
    ],
    explanation: '原因（個別導入）と結果（全社で使えない）の因果が中心です。',
  },
  {
    id: 'mf-2-02',
    level: 2,
    text: '読み返している間は文章が目の前にあるため、理解できたという感覚が生まれる。しかしその感覚は文章が手元にあることに由来する。',
    answer: '理解した感覚は、文章が手元にあることが生んでいる',
    distractors: [
      '読み返すほど理解は深まる',
      '文章は手元に置いて読むべきである',
      '感覚と理解は常に一致する',
    ],
    explanation: '「由来する」が、感覚の出どころを理解ではなく状況に帰しています。',
  },
  {
    id: 'mf-2-03',
    level: 2,
    text: '切り替えのたびに前の作業へ向けた注意が残り、新しい作業に使える注意は全量ではなくなる。',
    answer: '作業の切り替えは、使える注意の量を目減りさせる',
    distractors: [
      '複数の作業は同時に処理できる',
      '切り替えは所要時間だけを増やす',
      '注意は切り替えと同時に完全に移る',
    ],
    explanation: '残留という仕組みが、使える注意が減るという結論を導いています。',
  },
  {
    id: 'mf-2-04',
    level: 2,
    text: '価格の上昇を止めれば支払う額は抑えられるが、不足しているという情報は誰にも伝わらなくなる。',
    answer: '価格を抑えると、不足を伝える情報が失われる',
    distractors: [
      '価格を抑えれば不足は解消する',
      '価格の上昇は常に望ましい',
      '情報の伝達に価格は関係しない',
    ],
    explanation: '「が」以降が主眼で、統制の代償を述べています。',
  },

  // ---- Level 3: 抽象度が上がる ----
  {
    id: 'mf-3-01',
    level: 3,
    text: '仕様は動いているものを見れば分かる。実装から決して読み取れないのは、なぜその方式を選び、どの案を却下したのかである。',
    answer: '記録すべきは仕様ではなく、選択の理由である',
    distractors: [
      '仕様書は詳細に書くべきである',
      '実装を読めば設計の意図も分かる',
      '却下した案は記録する必要がない',
    ],
    explanation: '対比の後半（読み取れないもの）が、何を残すべきかを示しています。',
  },
  {
    id: 'mf-3-02',
    level: 3,
    text: '観測できた集団は全体の代表ではない。記録に残るのは結果が出たものであり、そうでないものは最初から数えられる場所にいない。',
    answer: '記録に残った事例だけを見ると、集団の性質を誤って推定する',
    distractors: [
      '記録はすべての事例を等しく含む',
      '観測する件数を増やせば正確になる',
      '結果が出た事例こそ分析に値する',
    ],
    explanation: '「数えられる場所にいない」が、標本の偏りを述べています。',
  },
  {
    id: 'mf-3-03',
    level: 3,
    text: '分業の利益は、能力の絶対的な差ではなく、その作業を選んだときに諦めるものの大きさから生まれる。',
    answer: '分業の利益を決めるのは機会費用の差である',
    distractors: [
      '分業は能力差が大きいほど有利である',
      '各人は最も得意な作業を担うべきである',
      '分業は総量を変えない',
    ],
    explanation: '「諦めるものの大きさ」が機会費用そのものを指しています。',
  },
  {
    id: 'mf-3-04',
    level: 3,
    text: '要約は情報を捨てる作業である。何を捨ててよいかは、何を知りたいかによって決まる。',
    answer: '指標の選択は、問いを決めた後に行うべきである',
    distractors: [
      '要約は情報を失わない',
      '指標を決めてから問いを立てるべきである',
      'できるだけ多くの情報を残すべきである',
    ],
    explanation: '二文目が、順序（問い→指標）を規定しています。',
  },

  // ---- Level 4: 情報密度が高い ----
  {
    id: 'mf-4-01',
    level: 4,
    text: '通信が途絶えた状況では、内容の食い違いを許して応答を返すか、応答を止めて正しさを保つかのどちらかしか選べない。どちらが妥当かはデータの種類によって変わる。',
    answer: '整合性と可用性の選択は、扱うデータごとに決めるべきである',
    distractors: [
      '通信の途絶時にも両立させる方法がある',
      '常に正しさを優先すべきである',
      'システム全体で方針を統一すべきである',
    ],
    explanation: '二文目が「データの種類によって」と、判断の単位を指定しています。',
  },
  {
    id: 'mf-4-02',
    level: 4,
    text: '平均が上がったという事実からは、全員が少しずつ増えたのか、大半が減る一方で一部が大きく増えたのかを区別できない。',
    answer: '平均の変化からは、分布の中で何が起きたかを復元できない',
    distractors: [
      '平均が上がれば全体の状況は改善している',
      '平均は分布の形を正しく保持する',
      '平均より合計を見るべきである',
    ],
    explanation: '「区別できない」が、要約による情報の喪失を述べています。',
  },
  {
    id: 'mf-4-03',
    level: 4,
    text: '事業を始めた後は、投じた資源の大きさが判断に影響する。既に支払った費用は将来の判断とは無関係のはずだが、組織の中ではそう扱われない。',
    answer: '既に投じた資源が、本来は無関係なはずの継続判断を歪める',
    distractors: [
      '投じた資源が多いほど合理的に判断できる',
      '過去の費用は組織でも正しく無視される',
      '撤退の判断は開始後のほうが容易である',
    ],
    explanation: '「そう扱われない」が、原則と実際のずれを指摘しています。',
  },
  {
    id: 'mf-4-04',
    level: 4,
    text: '原理が知られてから広く使われるまでの空白は、技術の未熟さではなく、それを組み込む周りの仕組みが揃っていないことによる。',
    answer: '普及を決めるのは性能ではなく、それを支える周辺の条件である',
    distractors: [
      '技術が未熟なうちは普及しない',
      '空白の期間は避けられない',
      '優れた技術は必ず普及する',
    ],
    explanation: '「ではなく」が、原因を性能から周辺条件へ置き換えています。',
  },

  // ---- Level 5: 抽象・複数論点 ----
  {
    id: 'mf-5-01',
    level: 5,
    text: '記録は選別を経て残る。書ける層の関心が主題を決め、保管の仕組みを持つ組織の文書が生き延びる。したがって記録がないことは、出来事がなかったことを意味しない。',
    answer: '史料の不在は事象の不在ではなく、残る条件の偏りを示している',
    distractors: [
      '記録が少ない時代は平穏であった',
      '組織の記録は個人の記録より正確である',
      '選別を経た記録ほど信頼できる',
    ],
    explanation: '三文目が結論で、前二文はその根拠になっています。',
  },
  {
    id: 'mf-5-02',
    level: 5,
    text: '再現の失敗は元の結果の誤りを意味しない。対象や条件の違い、報告に書かれていない手順など原因は複数あり、そのどれかを確かめる作業が改めて必要になる。',
    answer: '再現できないことは誤りの証明ではなく、原因の特定という別の作業を要求する',
    distractors: [
      '再現に失敗した研究は撤回すべきである',
      '再現の失敗原因は一つに特定できる',
      '条件の違いは再現に影響しない',
    ],
    explanation: '否定（誤りではない）と要求（別の作業）の二段構えが要点です。',
  },
  {
    id: 'mf-5-03',
    level: 5,
    text: '緑地の効果は面積の合計では決まらない。同じ面積でも、一か所に集約した場合と分散させた場合では、気温にも生き物の移動にも異なる結果が生じる。',
    answer: '効果を左右するのは総量ではなく配置である',
    distractors: [
      '面積が同じなら効果も同じである',
      '緑地は一か所に集約すべきである',
      '分散させると効果は失われる',
    ],
    explanation: '二文目が、量と配置を切り分ける根拠になっています。',
  },
  {
    id: 'mf-5-04',
    level: 5,
    text: '物価上昇は全員が一様に貧しくなる現象ではない。価格や賃金が動く速さの差によって、受け取る側と支払う側の間で実質的な購買力が移動する。',
    answer: '物価上昇の実態は、動く速さの差による購買力の移動である',
    distractors: [
      '物価上昇はすべての人を等しく貧しくする',
      '賃金は物価に即座に連動する',
      '購買力は物価上昇では移動しない',
    ],
    explanation: '「移動する」が結論で、速さの差がその機構です。',
  },
]

function build(draft: MeaningFlashItemDraft): MeaningFlashItem {
  const correctChoiceId = `${draft.id}-c0`
  const choices = seededShuffle(
    [
      { id: correctChoiceId, text: draft.answer },
      ...draft.distractors.map((text, i) => ({ id: `${draft.id}-c${i + 1}`, text })),
    ],
    draft.id,
  )
  return {
    id: draft.id,
    level: draft.level,
    text: draft.text,
    characterCount: draft.text.replace(/\s/g, '').length,
    prompt: PROMPT,
    choices,
    correctChoiceId,
    explanation: draft.explanation,
  }
}

export const MEANING_FLASH_ITEMS: readonly MeaningFlashItem[] = DRAFTS.map(build)

/** 指定レベルの教材。足りなければ隣接レベルで補う。 */
export function selectMeaningFlashItems(
  level: ChunkLevel,
  count: number,
  seed: string,
): MeaningFlashItem[] {
  const exact = MEANING_FLASH_ITEMS.filter((item) => item.level === level)
  const rest = MEANING_FLASH_ITEMS.filter((item) => item.level !== level).sort(
    (a, b) => Math.abs(a.level - level) - Math.abs(b.level - level),
  )
  return [...seededShuffle(exact, seed), ...rest].slice(0, count)
}
