import { z } from 'zod'

const difficulty = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

const choice = z.object({ id: z.string().min(1), text: z.string().min(1) })

const summaryChoice = choice.extend({ correct: z.boolean() })

const question = z.object({
  id: z.string().min(1),
  passageId: z.string().min(1),
  type: z.enum(['main_idea', 'detail', 'cause_effect', 'inference', 'structure']),
  prompt: z.string().min(1),
  choices: z.array(choice).min(2),
  correctChoiceId: z.string().min(1),
  explanation: z.string().min(1),
})

const paragraph = z.object({
  index: z.number().int().nonnegative(),
  text: z.string().min(1),
  summaryChoices: z.array(summaryChoice).min(2),
  predictionStop: z
    .object({ prompt: z.string().min(1), expectedPoints: z.array(z.string().min(1)).min(1) })
    .optional(),
})

export const difficultyFactorsSchema = z.object({
  vocabulary: difficulty,
  sentenceLength: difficulty,
  abstraction: difficulty,
  informationDensity: difficulty,
  logicalStructure: difficulty,
  domainSpecificity: difficulty,
})

export const passageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum([
    'business',
    'technology',
    'economics',
    'psychology',
    'science',
    'history',
    'general',
  ]),
  difficulty,
  source: z.enum(['seed', 'imported', 'generated']),
  content: z.string().min(1),
  characterCount: z.number().int().positive(),
  estimatedDifficulty: difficultyFactorsSchema,
  keyPoints: z.array(z.string().min(1)),
  paragraphs: z.array(paragraph),
  chunks: z.array(z.string().min(1)),
  speedSegments: z
    .array(
      z.object({
        text: z.string().min(1),
        importance: z.enum(['known', 'example', 'evidence', 'claim', 'key']),
        recommendedBand: z.enum(['fast', 'normal', 'slow']),
      }),
    )
    .optional(),
  questions: z.array(question),
})

export type ValidatedPassage = z.infer<typeof passageSchema>
