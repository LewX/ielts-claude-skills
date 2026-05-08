import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveReadingResult } from '../../runtime/reading-result.mjs';
import { readingResultSchema } from '../../runtime/schema.mjs';

test('deriveReadingResult marks unanswered questions separately from wrong answers', () => {
  const result = deriveReadingResult({
    examType: 'general-training',
    questions: [
      {
        id: 'q1',
        type: 'true-false-not-given',
        answerKey: 'FALSE',
        evidence: ['Open every day.'],
        paraphrasePairs: [{ prompt: 'closed', passage: 'open' }],
        explanation: 'The text says the opposite.',
      },
      {
        id: 'q2',
        type: 'sentence-completion',
        answerKey: 'community desk',
        evidence: ['Applications must be lodged at the community desk.'],
        paraphrasePairs: [{ prompt: 'submitted', passage: 'lodged' }],
        explanation: 'The required phrase appears directly in the passage.',
      }
    ],
    answers: {
      q1: 'FALSE'
    }
  });

  assert.equal(result.rawScore.correct, 1);
  assert.equal(result.rawScore.total, 2);
  assert.equal(result.questions[1].status, 'unanswered');
});

test('deriveReadingResult accepts array answer keys when the submitted answers match', () => {
  const result = deriveReadingResult({
    examType: 'general-training',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        answerKey: ['B', 'C'],
        evidence: ['The report names both options.'],
        paraphrasePairs: [],
        explanation: 'Both answers are accepted.',
      }
    ],
    answers: {
      q1: ['C', 'B']
    }
  });

  assert.equal(result.rawScore.correct, 1);
  assert.equal(result.questions[0].status, 'correct');
});

test('deriveReadingResult rejects string answers for array answer keys', () => {
  const result = deriveReadingResult({
    examType: 'general-training',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        answerKey: ['B'],
        evidence: ['The report names one option.'],
        paraphrasePairs: [],
        explanation: 'The answer must be submitted as an array.',
      }
    ],
    answers: {
      q1: 'B'
    }
  });

  assert.equal(result.rawScore.correct, 0);
  assert.equal(result.questions[0].status, 'wrong');
});

test('deriveReadingResult marks incorrect array answers as wrong', () => {
  const result = deriveReadingResult({
    examType: 'general-training',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        answerKey: ['B', 'C'],
        evidence: ['The report names both options.'],
        paraphrasePairs: [],
        explanation: 'Both answers are accepted.',
      }
    ],
    answers: {
      q1: ['B', 'D']
    }
  });

  assert.equal(result.rawScore.correct, 0);
  assert.equal(result.questions[0].status, 'wrong');
});

test('deriveReadingResult marks empty array answers as unanswered', () => {
  const result = deriveReadingResult({
    examType: 'general-training',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        answerKey: ['B', 'C'],
        evidence: ['The report names both options.'],
        paraphrasePairs: [],
        explanation: 'Both answers are accepted.',
      }
    ],
    answers: {
      q1: []
    }
  });

  assert.equal(result.rawScore.correct, 0);
  assert.equal(result.questions[0].status, 'unanswered');
  assert.equal(result.questions[0].userAnswer, null);
});

test('deriveReadingResult marks partial array matches as wrong', () => {
  const result = deriveReadingResult({
    examType: 'general-training',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        answerKey: ['B', 'C'],
        evidence: ['The report names both options.'],
        paraphrasePairs: [],
        explanation: 'Both answers are accepted.',
      }
    ],
    answers: {
      q1: ['B']
    }
  });

  assert.equal(result.rawScore.correct, 0);
  assert.equal(result.questions[0].status, 'wrong');
});

test('deriveReadingResult filters empty strings out of array answers', () => {
  const result = deriveReadingResult({
    examType: 'general-training',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        answerKey: ['B', ''],
        evidence: ['The report names both options.'],
        paraphrasePairs: [],
        explanation: 'Both answers are accepted.',
      }
    ],
    answers: {
      q1: ['B', '']
    }
  });

  assert.equal(result.rawScore.correct, 1);
  assert.equal(result.questions[0].status, 'correct');
  assert.deepEqual(result.questions[0].userAnswer, ['B']);
});

test('deriveReadingResult marks null or undefined array answers as unanswered', () => {
  const result = deriveReadingResult({
    examType: 'general-training',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        answerKey: ['B', 'C'],
        evidence: ['The report names both options.'],
        paraphrasePairs: [],
        explanation: 'Both answers are accepted.',
      }
    ],
    answers: {
      q1: [null, undefined]
    }
  });

  assert.equal(result.rawScore.correct, 0);
  assert.equal(result.questions[0].status, 'unanswered');
  assert.equal(result.questions[0].userAnswer, null);
});

test('readingResultSchema rejects impossible raw scores where correct exceeds total', () => {
  assert.throws(
    () =>
      readingResultSchema.parse({
        setId: 'set-001',
        examType: 'general-training',
        rawScore: { correct: 3, total: 2 },
        bandEstimate: { scaledCorrect: 12, band: 4, label: 'Estimated Band 4.0' },
        questions: [],
      }),
    /correct/i
  );
});
