import { seededShuffle } from '@/core/util/seeded-shuffle'
import { KANA_PICKUP } from '@/core/training/btr/kana-pickup'

/**
 * かなひろいの課題文。
 *
 * 説明文ではなく **物語文** にする。かなひろいは「拾いながら筋を追えるか」を見る
 * 二重課題なので、追う筋がない文章では片方の課題が消えてしまう。
 *
 * 内容確認の問いには、その答えが決まる行を持たせている。
 * 2分では読み切れない長さにしてあり、どこまで進めたかがそのまま成績になる。
 * 読んでいない先を訊けば、それは記憶ではなく運を測ることになるので、
 * **読み終えた行までの問いだけ**を出す。
 *
 * 課題文はすべて自前で書き起こしたものである。教室の教材は使っていない。
 */

export interface KanaStoryQuestion {
  readonly id: string
  readonly prompt: string
  readonly answer: string
  readonly distractors: readonly [string, string, string]
  /** この行を読み終えれば答えが決まる（0 始まり） */
  readonly afterLine: number
}

export interface KanaStory {
  readonly id: string
  readonly title: string
  /** 本文。1行ずつ。画面もこの単位で折り返す。 */
  readonly lines: readonly string[]
  /** afterLine の昇順で持つ。出題はここから読んだ範囲だけを取る。 */
  readonly questions: readonly KanaStoryQuestion[]
}

export const KANA_STORIES: readonly KanaStory[] = [
  {
    id: 'lighthouse',
    title: 'みさきの灯台',
    lines: [
      'うみべの町のはずれに、白い灯台が一つ立っていた。',
      'その灯台のあかりは、四十年のあいだ一度も消えたことがない。',
      'まもっていたのは、あさひという名の年おいた男だった。',
      'あさひは毎ばん、らせん階段を百二十段のぼってレンズをみがいた。',
      'みがくあいだ、あさひはいつも同じ古い歌をくちずさんでいた。',
      'ある冬の夕がた、町に大雪がふり、電線がきれてあかりが消えた。',
      '灯台の中はまっくらになり、あとには風のおとだけがのこった。',
      'あさひは物おきから古いランプを三つ取りだし、てっぺんへはこびあげた。',
      '一つ目のランプはすぐに油がきれ、二つ目は風にあおられて消えた。',
      'のこった三つ目を、あさひは上着でかこい、朝まで手ではさんでいた。',
      '手はやがてかじかみ、ゆびのさきの感かくがなくなっていった。',
      '夜あけまえ、沖にいた漁船がその小さなあかりを見つけて港へもどった。',
      '港では、村の人たちが毛布をかかえて、こごえながら待っていた。',
      '船からおりてきたのは、十年まえに町を出ていったあさひの息子だった。',
      '息子はまず、父の手がランプのすすで真っ黒になっているのに気づいた。',
      '二人はなにも言わずに、こおった階段をならんでおりていった。',
      'その朝あさひは、四十年ではじめて、あかりのない灯台をふりかえった。',
      '春になって、町は灯台にあたらしい電気をひきなおした。',
      '式のあとで、町長はあさひに小さな記念のたてをわたした。',
      'それでもあさひは、あのランプだけは物おきにもどさなかった。',
    ],
    questions: [
      {
        id: 'lighthouse-q1',
        prompt: '灯台をまもっていた男の名前は。',
        answer: 'あさひ',
        distractors: ['いずみ', 'うたの', 'えいじ'],
        afterLine: 2,
      },
      {
        id: 'lighthouse-q2',
        prompt: '男が毎ばんのぼっていた階段は何段か。',
        answer: '百二十段',
        distractors: ['四十段', '十二段', '二百段'],
        afterLine: 3,
      },
      {
        id: 'lighthouse-q3',
        prompt: '灯台のあかりが消えたのはなぜか。',
        answer: '大雪で電線がきれたから',
        distractors: [
          'レンズがわれてしまったから',
          '男が階段をのぼれなかったから',
          '町が灯台を閉じたから',
        ],
        afterLine: 5,
      },
      {
        id: 'lighthouse-q4',
        prompt: '男が物おきから取りだしたランプはいくつか。',
        answer: '三つ',
        distractors: ['一つ', '二つ', '四つ'],
        afterLine: 7,
      },
      {
        id: 'lighthouse-q5',
        prompt: '二つ目のランプはどうなったか。',
        answer: '風に吹かれて消えた',
        distractors: ['油がきれた', '割れて落ちた', '朝までついていた'],
        afterLine: 8,
      },
      {
        id: 'lighthouse-q6',
        prompt: '小さなあかりを見つけたのはだれか。',
        answer: '沖にいた漁船',
        distractors: ['町の消防団', '通りかかった列車', '灯台のとなりの家'],
        afterLine: 11,
      },
      {
        id: 'lighthouse-q9',
        prompt: '港で村の人たちは何をかかえて待っていたか。',
        answer: '毛布',
        distractors: ['ランプ', 'あたたかい食べもの', 'ロープ'],
        afterLine: 12,
      },
      {
        id: 'lighthouse-q7',
        prompt: '船からおりてきたのはだれか。',
        answer: '十年まえに町を出ていった息子',
        distractors: ['男の父親', '灯台の新しい番人', '町長'],
        afterLine: 13,
      },
      {
        id: 'lighthouse-q8',
        prompt: '春がきたあと、男はランプをどうしたか。',
        answer: '物おきにもどさなかった',
        distractors: [
          '息子にゆずった',
          '灯台のてっぺんに置いたままにした',
          '町の博物館におさめた',
        ],
        afterLine: 19,
      },
    ],
  },
  {
    id: 'mountain-bus',
    title: '山のバス',
    lines: [
      '山あいのその村には、一日に二本しかバスが来なかった。',
      '朝の便は六時、夕がたの便は五時に、いちょうの木の下を出る。',
      '中学生のいずみは、その夕がたの便にいつも乗りおくれていた。',
      '部かつが終わるのが五時十分で、どうしても十分だけ足りない。',
      '走っても間にあわないことは、いずみ自身がいちばんよく知っていた。',
      'いずみは三か月のあいだ、山道を一時間半あるいて家へ帰った。',
      'くらくなった坂道では、うしろから来る車のあかりだけがたよりだった。',
      'ある日、広場に着くと、バスがまだ扉をあけたまま止まっていた。',
      '運転手の男は時計を見ながら、五時十二分まで待っていたのだった。',
      'いずみが乗りこむと、男はなにも言わずに扉をしめた。',
      'つぎの日も、そのつぎの日も、バスはおなじように待っていた。',
      'だれもそのことを口にせず、時こく表も書きかえられなかった。',
      '冬になって乗りこむと、運転手の席には別の人がすわっていた。',
      '前の運転手はこしをいためて休んでいる、という話だった。',
      'いずみはその日、うつむいたまま窓のそとをながめていた。',
      'それでもバスは、その日も五時十二分に広場を出ていった。',
      '春に部かつを引たいしたあとも、いずみは五時の便に乗りつづけた。',
      '三年生の終わりに、いずみは営業所へおれいを言いに行った。',
      '引きつぎのノートを見せてもらうと、一行だけ書きたされていた。',
      '「五時十二分まで待つこと」と、そこにはあった。',
    ],
    questions: [
      {
        id: 'mountain-bus-q1',
        prompt: 'この村に来るバスは一日に何本か。',
        answer: '二本',
        distractors: ['一本', '三本', '六本'],
        afterLine: 0,
      },
      {
        id: 'mountain-bus-q2',
        prompt: '夕がたの便が広場を出るのは何時か。',
        answer: '五時',
        distractors: ['六時', '五時十分', '五時十二分'],
        afterLine: 1,
      },
      {
        id: 'mountain-bus-q3',
        prompt: 'いずみが夕がたの便に乗りおくれていたのはなぜか。',
        answer: '部かつが終わるのが五時十分だから',
        distractors: [
          '家が広場から遠かったから',
          '朝の便としか合わなかったから',
          'バスの時こくが毎日変わるから',
        ],
        afterLine: 3,
      },
      {
        id: 'mountain-bus-q4',
        prompt: 'いずみが山道をあるいて帰っていたのはどれくらいの間か。',
        answer: '三か月',
        distractors: ['一週間', '一年', '三年'],
        afterLine: 5,
      },
      {
        id: 'mountain-bus-q5',
        prompt: '運転手は何時まで扉をあけて待っていたか。',
        answer: '五時十二分',
        distractors: ['五時ちょうど', '五時十分', '五時半'],
        afterLine: 8,
      },
      {
        id: 'mountain-bus-q6',
        prompt: '時こく表はどうなったか。',
        answer: '書きかえられなかった',
        distractors: [
          '五時十二分に直された',
          '広場からはずされた',
          '朝の便だけ書きかえられた',
        ],
        afterLine: 11,
      },
      {
        id: 'mountain-bus-q7',
        prompt: '冬に運転手が変わったのはなぜか。',
        answer: '前の運転手がこしをいためたから',
        distractors: [
          '村を出ていったから',
          '別の路線にうつったから',
          '定年になったから',
        ],
        afterLine: 13,
      },
      {
        id: 'mountain-bus-q8',
        prompt: 'いずみがあとで知ったことは何か。',
        answer: '引きつぎのノートに一行書きたされていたこと',
        distractors: [
          '前の運転手が村にもどってきたこと',
          '夕がたの便がなくなること',
          '広場が別の場所にうつること',
        ],
        afterLine: 18,
      },
      {
        id: 'mountain-bus-q9',
        prompt: 'ノートに書きたされていた一行は何か。',
        answer: '五時十二分まで待つこと',
        distractors: [
          '五時ちょうどに出ること',
          'いずみを乗せること',
          '時こく表を書きかえること',
        ],
        afterLine: 19,
      },
    ],
  },
  {
    id: 'clock-shop',
    title: '時計屋のねこ',
    lines: [
      '商店がいのかどに、古い時計屋が一けんだけのこっていた。',
      '店の主人はもう八十をこえていて、耳がとおくなっていた。',
      'その店には、いつのころからか灰いろのねこが住みついていた。',
      'ねこは棚の上でねむり、正午になるとかならず起きあがった。',
      '店じゅうの時計が、いっせいに正午をうちはじめるからである。',
      '主人はそのおとを、手のひらでガラスにふれてたしかめていた。',
      'ある夏、大きなふり子時計が一つだけ、音を出さなくなった。',
      '主人は耳がとおいので、鳴っていないことに気づかなかった。',
      'けれどもねこは、その時計のまえにすわったまま、うごかなくなった。',
      'えさをおいても、ねこは棚にもどろうとしなかった。',
      '三日目に、店をてつだいに来た孫むすめがふり子時計をあけた。',
      '中では、小さなねじが一本だけ、底にころがりおちていた。',
      'ねじをもどすと、時計はその日の正午からまたうちはじめた。',
      'ねこは棚の上にもどって、また昼までねむるようになった。',
      '孫むすめはそれから、週に一度だけ店に立つようになった。',
      '主人は、時計のおとがわかるのは自分ではなくねこだと言った。',
      '秋のはじめ、店のガラス戸に一まいの紙がはられた。',
      '「時計のしゅうりうけたまわります」と、あたらしい字で書いてあった。',
      'それは主人の字ではなく、孫むすめが書いたものだった。',
      'ねこはあいかわらず、正午になると棚の上で起きあがった。',
    ],
    questions: [
      {
        id: 'clock-shop-q1',
        prompt: '店の主人はいくつくらいか。',
        answer: '八十をこえている',
        distractors: ['六十くらい', '七十ちょうど', '九十をこえている'],
        afterLine: 1,
      },
      {
        id: 'clock-shop-q2',
        prompt: 'ねこが起きあがるのは何時か。',
        answer: '正午',
        distractors: ['朝の六時', '夕がたの五時', '真夜中'],
        afterLine: 3,
      },
      {
        id: 'clock-shop-q3',
        prompt: 'ねこが正午に起きるのはなぜか。',
        answer: '店じゅうの時計がいっせいに鳴るから',
        distractors: [
          '主人がえさをやるから',
          '店の戸があけられるから',
          '日ざしが棚に当たるから',
        ],
        afterLine: 4,
      },
      {
        id: 'clock-shop-q4',
        prompt: '音を出さなくなったのはどの時計か。',
        answer: '大きなふり子時計',
        distractors: ['店の柱時計', '主人のうで時計', '棚の上の目ざまし時計'],
        afterLine: 6,
      },
      {
        id: 'clock-shop-q5',
        prompt: '主人が気づかなかったのはなぜか。',
        answer: '耳がとおくなっていたから',
        distractors: [
          '店をあけていなかったから',
          '目がよく見えなかったから',
          '時計が多すぎたから',
        ],
        afterLine: 7,
      },
      {
        id: 'clock-shop-q6',
        prompt: 'ふり子時計をあけたのはだれか。',
        answer: '孫むすめ',
        distractors: ['店の主人', '近所の時計職人', 'ねこの飼い主'],
        afterLine: 10,
      },
      {
        id: 'clock-shop-q7',
        prompt: '時計の中はどうなっていたか。',
        answer: '小さなねじが一本おちていた',
        distractors: [
          'ふり子がはずれていた',
          'ぜんまいが切れていた',
          'ほこりがつまっていた',
        ],
        afterLine: 11,
      },
      {
        id: 'clock-shop-q8',
        prompt: '直したあと、時計はいつから鳴りはじめたか。',
        answer: 'その日の正午から',
        distractors: ['つぎの日の朝から', 'すぐその場から', '夏が終わってから'],
        afterLine: 12,
      },
      {
        id: 'clock-shop-q9',
        prompt: 'ガラス戸にはられた紙は、だれが書いたものか。',
        answer: '孫むすめ',
        distractors: ['店の主人', '商店がいの人', '時計職人'],
        afterLine: 18,
      },
    ],
  },
]

/** その日の課題文。同じ種なら同じ話になる。 */
export function pickKanaStory(seed: string): KanaStory {
  const [story] = seededShuffle(KANA_STORIES, `kana-story:${seed}`)
  return story ?? KANA_STORIES[0]!
}

export interface KanaQuestionChoice {
  readonly id: string
  readonly text: string
}

export interface KanaQuestionView {
  readonly id: string
  readonly prompt: string
  readonly choices: readonly KanaQuestionChoice[]
  readonly correctChoiceId: string
}

/**
 * 読んだ範囲から等間隔に取る。
 *
 * 手前から順に取ると、遠くまで読んだ人ほど読んだばかりの箇所を訊かれずに終わる。
 * 範囲全体に散らせば、どこまで読んでも同じ濃さで訊かれる。
 */
function spread<T>(items: readonly T[], count: number): T[] {
  if (count <= 0) return []
  if (items.length <= count) return [...items]
  if (count === 1) return [items[items.length - 1]!]

  const step = (items.length - 1) / (count - 1)
  return Array.from({ length: count }, (_, i) => items[Math.round(i * step)]!)
}

/**
 * 内容確認の出題。
 *
 * **読み終えた行までの問いだけ**を出す。読んでいない先を訊けば、
 * 測っているのは記憶ではなく運になる。
 * 一行も読めていなければ0問になり、その回の内容確認は成立しない。
 */
export function selectKanaQuestions(
  story: KanaStory,
  reachedLine: number,
  seed: string,
  count: number = KANA_PICKUP.questionCount,
): KanaQuestionView[] {
  const reachable = story.questions.filter((question) => question.afterLine <= reachedLine)

  return spread(reachable, count).map((question) => {
    const correctChoiceId = `${question.id}-c0`
    return {
      id: question.id,
      prompt: question.prompt,
      correctChoiceId,
      choices: seededShuffle(
        [
          { id: correctChoiceId, text: question.answer },
          ...question.distractors.map((text, i) => ({ id: `${question.id}-c${i + 1}`, text })),
        ],
        `${seed}:${question.id}`,
      ),
    }
  })
}
