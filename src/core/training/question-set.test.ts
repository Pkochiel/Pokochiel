import { describe, expect, it } from 'vitest'
import { QUESTIONS } from '../config/training-config'
import type { QuestionType, TrainingQuestion } from '../types/passage'
import {
  comprehensionQuestions,
  questionBudget,
  readCheckQuestions,
  selectQuestions,
  structureProbeIndexes,
} from './question-set'

const question = (id: string, type: QuestionType): TrainingQuestion => ({
  id,
  passageId: 'p1',
  type,
  prompt: `${id} の設問`,
  choices: [
    { id: `${id}-a`, text: 'a' },
    { id: `${id}-b`, text: 'b' },
  ],
  correctChoiceId: `${id}-a`,
  explanation: '',
})

/** 教材はどれもこの5種を1問ずつ持つ（content.test.ts で強制している）。 */
const POOL: TrainingQuestion[] = [
  question('q1', 'main_idea'),
  question('q2', 'detail'),
  question('q3', 'cause_effect'),
  question('q4', 'inference'),
  question('q5', 'structure'),
]

describe('selectQuestions', () => {
  it('limit の分だけ、教材の並び順のまま返す', () => {
    expect(selectQuestions(POOL, { limit: 3 }).map((q) => q.id)).toEqual(['q1', 'q2', 'q3'])
  })

  it('設問が limit より少なければ全問返す', () => {
    expect(selectQuestions(POOL.slice(0, 2), { limit: 5 })).toHaveLength(2)
  })

  it('limit が 0 以下なら出題しない', () => {
    expect(selectQuestions(POOL, { limit: 0 })).toEqual([])
    expect(selectQuestions(POOL, { limit: -1 })).toEqual([])
  })

  it('deprioritize した種別を最初に落とす', () => {
    const selected = selectQuestions(POOL, { limit: 4, deprioritize: ['structure'] })
    expect(selected.map((q) => q.type)).not.toContain('structure')
    expect(selected).toHaveLength(4)
  })

  it('落とした後も教材の並び順を保つ', () => {
    const selected = selectQuestions(POOL, { limit: 4, deprioritize: ['main_idea'] })
    expect(selected.map((q) => q.id)).toEqual(['q2', 'q3', 'q4', 'q5'])
  })

  it('deprioritize しても、枠が余れば落とさずに出す', () => {
    const selected = selectQuestions(POOL, { limit: 5, deprioritize: ['structure'] })
    expect(selected.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5'])
  })
})

describe('comprehensionQuestions', () => {
  it('設定の問数に絞り、Structure Reading と重複する種別を外す', () => {
    const selected = comprehensionQuestions(POOL)
    expect(selected).toHaveLength(QUESTIONS.comprehension)
    expect(selected.map((q) => q.type)).not.toContain('structure')
  })

  it('速度調整の最低設問数を下回らない', () => {
    // これを割ると adaptSpeed が常に hold になり、目標速度が動かなくなる。
    expect(QUESTIONS.comprehension).toBeGreaterThanOrEqual(4)
  })
})

describe('questionBudget', () => {
  it('時間が長いほど多く出せる（上限まで）', () => {
    expect(questionBudget(1, 3)).toBe(2)
    expect(questionBudget(2, 3)).toBe(2)
    expect(questionBudget(3, 3)).toBe(3)
    expect(questionBudget(6, 3)).toBe(3)
  })

  it('上限を超えない', () => {
    expect(questionBudget(60, 3)).toBe(3)
  })

  it('短いブロックでも下限を割らない', () => {
    expect(questionBudget(0, 3)).toBe(QUESTIONS.minPerBlock)
  })

  it('上限が下限より小さければ上限に従う', () => {
    expect(questionBudget(1, 1)).toBe(1)
  })

  it('上限が 0 以下なら出題しない', () => {
    expect(questionBudget(10, 0)).toBe(0)
    expect(questionBudget(10, -1)).toBe(0)
  })
})

describe('readCheckQuestions', () => {
  it('時間のあるブロックでは設定の問数を出す', () => {
    expect(readCheckQuestions(POOL, 5)).toHaveLength(QUESTIONS.readCheck)
  })

  it('短いブロックでは減らす', () => {
    expect(readCheckQuestions(POOL, 2).length).toBeLessThan(QUESTIONS.readCheck)
  })

  it('レベル調整で「維持」の帯が残る問数を上限にしている', () => {
    // 2問だと正答率が 0 / 50 / 100 になり、0.6〜0.85 の維持帯に入る値がなくなる。
    expect(QUESTIONS.readCheck).toBeGreaterThanOrEqual(3)
  })
})

describe('structureProbeIndexes', () => {
  /** 上限いっぱい（3問）を出せる長さのブロック。 */
  const LONG = 6
  /** 下限（2問）まで絞られる長さのブロック。 */
  const SHORT = 2

  it('段落数が上限以下なら全段落を問う', () => {
    expect(structureProbeIndexes(2, LONG)).toEqual([0, 1])
  })

  it('最初と最後を必ず含める', () => {
    const picked = structureProbeIndexes(7, LONG)
    expect(picked[0]).toBe(0)
    expect(picked[picked.length - 1]).toBe(6)
  })

  it('段落が増えても設問は増えない', () => {
    for (const count of [4, 5, 6, 7, 8, 12]) {
      expect(structureProbeIndexes(count, LONG)).toHaveLength(QUESTIONS.structureProbes)
    }
  })

  it('等間隔に選ぶ', () => {
    expect(structureProbeIndexes(5, LONG)).toEqual([0, 2, 4])
    expect(structureProbeIndexes(7, LONG)).toEqual([0, 3, 6])
  })

  it('短いブロックでは問う段落を減らす', () => {
    const short = structureProbeIndexes(7, SHORT)
    expect(short).toHaveLength(QUESTIONS.minPerBlock)
    expect(short.length).toBeLessThan(structureProbeIndexes(7, LONG).length)
  })

  it('重複しない昇順の番号を返す', () => {
    const picked = structureProbeIndexes(9, LONG)
    expect(new Set(picked).size).toBe(picked.length)
    expect([...picked].sort((a, b) => a - b)).toEqual(picked)
  })

  it('段落がなければ出題しない', () => {
    expect(structureProbeIndexes(0, LONG)).toEqual([])
  })
})
