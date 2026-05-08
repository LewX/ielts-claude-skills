import { z } from 'zod';

export const findingSchema = z.object({
  tag: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high']),
});

export const artifactSchema = z.object({
  kind: z.enum(['rewrite', 'synonym-set', 'speaking-story']),
  title: z.string().min(1),
  content: z.string().min(1),
});

const nullableNumber = z.number().nullable();

const paraphrasePairSchema = z.object({
  prompt: z.string().min(1),
  passage: z.string().min(1),
});

const readingQuestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['true-false-not-given', 'sentence-completion', 'multiple-choice']),
  prompt: z.string().min(1),
  options: z.array(z.string()).optional(),
  answerKey: z.union([z.string(), z.array(z.string())]),
  evidence: z.array(z.string().min(1)).min(1),
  paraphrasePairs: z.array(paraphrasePairSchema),
  explanation: z.string().min(1),
  wordLimit: z.number().int().positive().optional(),
});

export const attemptSchema = z.object({
  skill: z.enum(['ielts-writing', 'ielts-reading', 'ielts-speaking', 'ielts']),
  mode: z.string().min(1),
  timestamp: z.string().datetime(),
  title: z.string().min(1),
  scores: z.object({
    tr: nullableNumber,
    cc: nullableNumber,
    lr: nullableNumber,
    gra: nullableNumber,
    overall: nullableNumber,
  }),
  summary: z.string().min(1),
  findings: z.array(findingSchema),
  artifacts: z.array(artifactSchema),
});

export const readingResultSchema = z.object({
  setId: z.string().min(1),
  examType: z.enum(['general-training', 'academic']),
  rawScore: z
    .object({
      correct: z.number().int().min(0),
      total: z.number().int().min(0),
    })
    .refine(({ correct, total }) => correct <= total, {
      message: 'correct must not exceed total',
      path: ['correct'],
    }),
  bandEstimate: z.object({
    scaledCorrect: z.number().nullable(),
    band: z.number().nullable(),
    label: z.string().min(1),
  }),
  questions: z.array(z.any()),
});

export const readingSetSchema = z.object({
  id: z.string().min(1),
  source: z.enum(['generated']),
  examType: z.enum(['general-training', 'academic']),
  title: z.string().min(1),
  passage: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
  }),
  questions: z.array(readingQuestionSchema).min(1),
});

export const readingUiPracticeSessionSchema = z.object({
  view: z.literal('practice'),
  set: readingSetSchema,
});

export const readingUiReviewSessionSchema = z.object({
  view: z.literal('review'),
  result: readingResultSchema,
  set: readingSetSchema.optional(),
});

export const readingUiSessionSchema = z.discriminatedUnion('view', [
  readingUiPracticeSessionSchema,
  readingUiReviewSessionSchema,
]);
