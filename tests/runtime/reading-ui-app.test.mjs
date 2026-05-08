import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeSessionView, renderSession } from '../../runtime/ui/reading/app.js';

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function bootstrapApp(fetchImpl) {
  const app = { innerHTML: '' };
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalConsole = globalThis.console;

  globalThis.document = {
    querySelector(selector) {
      return selector === '#app' ? app : null;
    },
  };
  globalThis.fetch = fetchImpl;
  globalThis.console = { error() {} };

  try {
    await import(new URL(`../../runtime/ui/reading/app.js?bootstrap=${Date.now()}`, import.meta.url).href);
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }

    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }

    if (originalConsole === undefined) {
      delete globalThis.console;
    } else {
      globalThis.console = originalConsole;
    }
  }

  return app;
}

function createPracticeSession() {
  return {
    view: 'practice',
    set: {
      id: 'set-001',
      source: 'generated',
      examType: 'general-training',
      title: 'Community update set',
      passage: {
        title: 'Library Renovation Notice',
        body: 'The library will stay open during weekdays while the upstairs study rooms are repainted.',
      },
      questions: [
        {
          id: 'q1',
          type: 'true-false-not-given',
          prompt: 'The library will close on weekdays.',
          options: ['TRUE', 'FALSE', 'NOT GIVEN'],
          answerKey: 'FALSE',
          evidence: ['The library will stay open during weekdays.'],
          paraphrasePairs: [{ prompt: 'close on weekdays', passage: 'stay open during weekdays' }],
          explanation: 'The passage states the opposite.',
        },
        {
          id: 'q2',
          type: 'sentence-completion',
          prompt: 'The upstairs study rooms are being _____.',
          answerKey: 'repainted',
          evidence: ['the upstairs study rooms are repainted'],
          paraphrasePairs: [{ prompt: 'being', passage: 'are repainted' }],
          explanation: 'The passage names repainting as the change.',
          wordLimit: 1,
        },
        {
          id: 'q3',
          type: 'multiple-choice',
          prompt: 'Which area is changing?',
          options: ['Reception desk', 'Upstairs study rooms', 'Cafe seating'],
          answerKey: 'Upstairs study rooms',
          evidence: ['the upstairs study rooms are repainted'],
          paraphrasePairs: [{ prompt: 'area is changing', passage: 'study rooms are repainted' }],
          explanation: 'Only the upstairs study rooms are mentioned.',
        },
      ],
    },
  };
}

function createReviewSession() {
  return {
    view: 'review',
    set: {
      id: 'set-001',
      source: 'generated',
      examType: 'general-training',
      title: 'Community update set',
      passage: {
        title: 'Library Renovation Notice',
        body: [
          'The library will stay open during weekdays while the upstairs study rooms are repainted.',
          'Staff will redirect students to the downstairs reference area until the work is complete.',
        ].join('\n\n'),
      },
      questions: [
        {
          id: 'q1',
          type: 'true-false-not-given',
          prompt: 'The library will close on weekdays.',
          options: ['TRUE', 'FALSE', 'NOT GIVEN'],
          answerKey: 'FALSE',
          evidence: ['The library will stay open during weekdays.'],
          paraphrasePairs: [{ prompt: 'close on weekdays', passage: 'stay open during weekdays' }],
          explanation: 'The passage states the opposite.',
        },
        {
          id: 'q2',
          type: 'sentence-completion',
          prompt: 'Students are redirected to the _____ reference area.',
          answerKey: 'downstairs',
          evidence: ['Staff will redirect students to the downstairs reference area'],
          paraphrasePairs: [{ prompt: 'redirected', passage: 'will redirect students' }],
          explanation: 'The passage names the downstairs reference area directly.',
          wordLimit: 1,
        },
      ],
    },
    result: {
      rawScore: { correct: 1, total: 2 },
      bandEstimate: { scaledCorrect: 20, band: 5.5, label: 'Estimated Band 5.5' },
      questions: [
        {
          questionId: 'q1',
          questionType: 'true-false-not-given',
          userAnswer: 'TRUE',
          correctAnswer: 'FALSE',
          isCorrect: false,
          status: 'wrong',
          evidence: ['The library will stay open during weekdays.'],
          paraphrasePairs: [{ prompt: 'close on weekdays', passage: 'stay open during weekdays' }],
          explanation: 'The passage states the opposite.',
        },
        {
          questionId: 'q2',
          questionType: 'sentence-completion',
          userAnswer: null,
          correctAnswer: 'downstairs',
          isCorrect: false,
          status: 'unanswered',
          evidence: ['Staff will redirect students to the downstairs reference area'],
          paraphrasePairs: [{ prompt: 'redirected', passage: 'will redirect students' }],
          explanation: 'The passage names the downstairs reference area directly.',
        },
      ],
    },
  };
}

test('reading UI shows a fallback when /session fetch fails', async () => {
  const app = await bootstrapApp(async () => {
    throw new TypeError('network down');
  });

  await settle();

  assert.match(app.innerHTML, /Unable to load reading session/u);
  assert.match(app.innerHTML, /reading-error/u);
});

test('reading UI renders practice passage, questions, and submit controls', () => {
  const html = renderSession(createPracticeSession());

  assert.match(html, /Library Renovation Notice/u);
  assert.match(html, /The library will stay open during weekdays/u);
  assert.match(html, /The library will close on weekdays\./u);
  assert.match(html, /TRUE/u);
  assert.match(html, /word limit: 1/i);
  assert.match(html, /Upstairs study rooms/u);
  assert.match(html, /Submit answers/u);
});

test('reading UI shows a fallback when a review payload is incomplete', async () => {
  const app = await bootstrapApp(async () => ({
    ok: true,
    json: async () => ({
      view: 'review',
      result: {
        rawScore: { correct: 8, total: 10 },
        bandEstimate: {},
      },
    }),
  }));

  await settle();

  assert.match(app.innerHTML, /Unable to load reading session/u);
  assert.match(app.innerHTML, /reading-error/u);
});

test('review UI keeps the passage visible and highlights the first question by default', () => {
  const html = renderSession(createReviewSession());

  assert.match(html, /Library Renovation Notice/u);
  assert.match(html, /Staff will redirect students to the downstairs reference area/u);
  assert.match(html, /review-card review-card--wrong review-card--active/u);
  assert.match(html, /状态：错误/u);
  assert.match(html, /答案依据：/u);
  assert.match(html, /你的答案：TRUE/u);
  assert.match(html, /正确答案：FALSE/u);
  assert.match(html, /你选错了，需要回到原文定位依据，再比较题干和原文是否同义或相反。/u);
  assert.match(html, /你选择了TRUE，正确答案是FALSE。/u);
  assert.match(html, /<mark class="passage-highlight">The library will stay open during weekdays<\/mark>/u);
  assert.doesNotMatch(html, /<mark class="passage-highlight">The library will stay open during weekdays\.<\/mark>/u);
});

test('review UI renders an unanswered review card when q2 is the active question', () => {
  const html = renderSession(createReviewSession(), { activeQuestionId: 'q2' });

  assert.match(html, /class="review-card review-card--unanswered review-card--active"[^>]*data-question-id="q2"/u);
  assert.match(html, /状态：未作答/u);
  assert.match(html, /你还没有作答，先看原文中的依据句，再倒推正确答案。/u);
  assert.match(html, /本题正确答案是downstairs。/u);
  assert.match(html, /<mark class="passage-highlight">Staff will redirect students to the downstairs reference area<\/mark>/u);
  assert.doesNotMatch(html, /<mark class="passage-highlight">The library will stay open during weekdays\.<\/mark>/u);
});

test('review UI does not create nested passage highlights when evidence overlaps', () => {
  const session = {
    view: 'review',
    set: {
      id: 'set-overlap',
      source: 'generated',
      examType: 'general-training',
      title: 'Overlap set',
      passage: {
        title: 'Overlap passage',
        body: 'The library will stay open during weekdays.',
      },
      questions: [
        {
          id: 'q1',
          prompt: 'Overlap question',
        },
      ],
    },
    result: {
      rawScore: { correct: 0, total: 1 },
      bandEstimate: { scaledCorrect: 0, band: 0, label: 'Estimated Band 0' },
      questions: [
        {
          questionId: 'q1',
          questionType: 'true-false-not-given',
          userAnswer: 'TRUE',
          correctAnswer: 'FALSE',
          isCorrect: false,
          status: 'wrong',
          evidence: [
            'The library will stay open during weekdays.',
            'The library will stay open',
          ],
          paraphrasePairs: [],
          explanation: 'Overlap evidence',
        },
      ],
    },
  };

  const html = renderSession(session);

  assert.doesNotMatch(html, /<mark class="passage-highlight">[\s\S]*<mark class="passage-highlight">/u);
});

test('review UI registers listeners for each review card', () => {
  const listeners = new Map();
  const cards = ['q1', 'q2'].map((questionId) => ({
    dataset: { questionId },
    addEventListener(eventName, handler) {
      if (eventName === 'click') {
        listeners.set(questionId, handler);
      }
    },
  }));

  let currentHtml = '';
  const app = {
    get innerHTML() {
      return currentHtml;
    },
    set innerHTML(value) {
      currentHtml = value;
    },
    querySelectorAll(selector) {
      return selector === '[data-review-card]' ? cards : [];
    },
  };

  initializeSessionView(app, createReviewSession());
  assert.equal(listeners.size, 2);
  assert.ok(listeners.has('q1'));
  assert.ok(listeners.has('q2'));
});
