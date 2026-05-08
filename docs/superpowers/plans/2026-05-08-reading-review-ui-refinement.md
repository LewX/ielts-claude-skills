# Reading Review UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the reading review UI so it keeps the passage visible, highlights the active question’s evidence in the passage, makes review states visually obvious, and presents review explanations in Chinese.

**Architecture:** Keep the existing reading practice flow and local server unchanged, but upgrade the browser review rendering in `runtime/ui/reading/app.js` to use an explicit review-state model. Reuse the existing two-column shell, add active-question state plus passage highlighting, and strengthen the style contract in `runtime/ui/reading/styles.css` so review status is obvious without reading the explanation text.

**Tech Stack:** Node.js ESM, built-in `node:test`, static browser JavaScript in `runtime/ui/reading/app.js`, static CSS in `runtime/ui/reading/styles.css`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `runtime/ui/reading/app.js` | Modify | Export testable review rendering helpers, keep passage visible in review mode, track active review question, render evidence highlights, and convert explanation copy to Chinese |
| `runtime/ui/reading/styles.css` | Modify | Add visible review status badges, active-card treatment, passage highlight styling, and stronger correct/wrong/unanswered emphasis |
| `tests/runtime/reading-ui-app.test.mjs` | Modify | Lock review rendering, default active question, question switching, Chinese explanation copy, and evidence highlighting behavior |
| `tests/runtime/reading-ui-server.test.mjs` | Modify | Lock the persisted CSS contract for new review selectors after assets are copied into the project |

---

### Task 1: Lock the refined review rendering contract with failing tests

**Files:**
- Modify: `tests/runtime/reading-ui-app.test.mjs`

- [ ] **Step 1: Add a review-session fixture that matches the new UI requirements**

In `tests/runtime/reading-ui-app.test.mjs`, add a second fixture beside `createPracticeSession()` so tests can render a fully populated review state:

```js
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
```

- [ ] **Step 2: Add a failing test for default review layout and highlight behavior**

Still in `tests/runtime/reading-ui-app.test.mjs`, switch from file-source VM execution to ESM imports so the test can call exported helpers directly:

```js
import { initializeSessionView, renderSession } from '../../runtime/ui/reading/app.js';

test('review UI keeps the passage visible and highlights the first question by default', () => {
  const html = renderSession(createReviewSession());

  assert.match(html, /Library Renovation Notice/u);
  assert.match(html, /Staff will redirect students to the downstairs reference area/u);
  assert.match(html, /review-card review-card--wrong review-card--active/u);
  assert.match(html, /状态：错误/u);
  assert.match(html, /答案依据：/u);
  assert.match(html, /你的答案：TRUE/u);
  assert.match(html, /正确答案：FALSE/u);
  assert.match(html, /你选错了，需要回到原文定位依据。/u);
  assert.match(html, /<mark class="passage-highlight">The library will stay open during weekdays\.<\/mark>/u);
});
```

- [ ] **Step 3: Add a failing test for switching the active review card**

Add a second test proving that review selection changes both the active card and the highlighted passage evidence:

```js
test('review UI switches the active question and evidence highlight when another card is selected', () => {
  const listeners = new Map();
  const cards = ['q1', 'q2'].map((questionId) => ({
    dataset: { questionId },
    addEventListener(eventName, handler) {
      if (eventName === 'click') {
        listeners.set(questionId, handler);
      }
    },
  }));

  const app = {
    innerHTML: '',
    querySelectorAll(selector) {
      return selector === '[data-review-card]' ? cards : [];
    },
  };

  initializeSessionView(app, createReviewSession());
  listeners.get('q2')();

  assert.match(app.innerHTML, /data-question-id="q2"[\s\S]*review-card--active/u);
  assert.match(app.innerHTML, /状态：未作答/u);
  assert.match(app.innerHTML, /你还没有作答，先看原文中的依据句。/u);
  assert.match(app.innerHTML, /<mark class="passage-highlight">Staff will redirect students to the downstairs reference area<\/mark>/u);
  assert.doesNotMatch(app.innerHTML, /<mark class="passage-highlight">The library will stay open during weekdays\.<\/mark>/u);
});
```

- [ ] **Step 4: Run the targeted test to verify it fails**

Run:

```bash
node --test tests/runtime/reading-ui-app.test.mjs
```

Expected: FAIL because `runtime/ui/reading/app.js` does not export `renderSession` / `initializeSessionView`, does not keep the passage visible in review mode, does not mark an active review card, and does not generate Chinese review copy.

- [ ] **Step 5: Commit the failing-test checkpoint**

```bash
git add tests/runtime/reading-ui-app.test.mjs
git commit -m "test: lock reading review refinement contract"
```

---

### Task 2: Implement review-state rendering and Chinese explanation copy

**Files:**
- Modify: `runtime/ui/reading/app.js`
- Test: `tests/runtime/reading-ui-app.test.mjs`

- [ ] **Step 1: Export testable rendering helpers and guard browser bootstrap**

In `runtime/ui/reading/app.js`, make the module importable from tests by exporting the helpers and only auto-bootstrapping when `document` exists:

```js
export function renderSession(session, uiState = {}) {
  // existing body moves here
}

export function initializeSessionView(app, session, uiState = {}) {
  app.innerHTML = renderSession(session, uiState);

  if (session.view === 'practice') {
    bindPracticeForm(app, session);
    return;
  }

  bindReviewCards(app, session, uiState);
}

if (typeof document !== 'undefined') {
  bootstrap();
}
```

- [ ] **Step 2: Add explicit review-state helpers**

Still in `runtime/ui/reading/app.js`, add review-state helpers so the UI has a single active question at a time:

```js
function getDefaultActiveQuestionId(session) {
  return session.result?.questions?.[0]?.questionId ?? null;
}

function getActiveQuestionResult(session, uiState) {
  const activeQuestionId = uiState.activeQuestionId ?? getDefaultActiveQuestionId(session);
  return session.result.questions.find((question) => question.questionId === activeQuestionId)
    ?? session.result.questions[0];
}

function getStatusMeta(status) {
  if (status === 'correct') {
    return { label: '正确', className: 'status-badge--correct' };
  }

  if (status === 'wrong') {
    return { label: '错误', className: 'status-badge--wrong' };
  }

  return { label: '未作答', className: 'status-badge--unanswered' };
}
```

- [ ] **Step 3: Render the review page with the passage visible and highlighted evidence**

Replace the current review-only summary output with a two-column review layout:

```js
function highlightEvidence(body, evidence) {
  let html = escapeHtml(body);

  for (const snippet of evidence) {
    const escapedSnippet = escapeHtml(snippet);
    html = html.replace(
      escapedSnippet,
      `<mark class="passage-highlight">${escapedSnippet}</mark>`
    );
  }

  return html
    .split(/\n{2,}/u)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join('');
}

function createChineseExplanation(question) {
  if (question.status === 'correct') {
    return '你的答案正确，可以对照原文中的依据句确认定位过程。';
  }

  if (question.status === 'unanswered') {
    return '你还没有作答，先看原文中的依据句，再倒推正确答案。';
  }

  return '你选错了，需要回到原文定位依据，再比较题干和原文是否同义或相反。';
}

function renderReviewSession(session, uiState = {}) {
  const activeQuestion = getActiveQuestionResult(session, uiState);

  return `
    <div class="reading-layout reading-layout--review">
      <section class="reading-panel passage-panel">
        <p class="panel-eyebrow">${escapeHtml(session.set.title)}</p>
        <h2>${escapeHtml(session.set.passage.title)}</h2>
        <div class="passage-body">
          ${highlightEvidence(session.set.passage.body, activeQuestion.evidence ?? [])}
        </div>
      </section>
      <section class="reading-panel review-panel">
        ${renderSummary(session.result)}
        ${renderReviewQuestions(session.result, session.set, activeQuestion.questionId)}
      </section>
    </div>
  `;
}
```

- [ ] **Step 4: Render visible status badges and Chinese labels inside review cards**

Update `renderReviewQuestions()` so each card has an active state, Chinese labels, and the new explanation block:

```js
function renderReviewQuestions(result, set, activeQuestionId) {
  const promptById = new Map(set.questions.map((question) => [question.id, question.prompt]));

  return `
    <section class="review-list">
      ${result.questions.map((question, index) => {
        const statusMeta = getStatusMeta(question.status);
        const activeClass = question.questionId === activeQuestionId ? 'review-card--active' : '';

        return `
          <article
            class="review-card review-card--${escapeHtml(question.status)} ${activeClass}"
            data-review-card
            data-question-id="${escapeHtml(question.questionId)}"
          >
            <div class="review-card-header">
              <p class="question-number">Question ${index + 1}</p>
              <span class="status-badge ${statusMeta.className}">${statusMeta.label}</span>
            </div>
            <h3>${escapeHtml(promptById.get(question.questionId) ?? question.questionId)}</h3>
            <p><strong>状态：</strong>${statusMeta.label}</p>
            <p><strong>你的答案：</strong>${escapeHtml(formatAnswer(question.userAnswer))}</p>
            <p><strong>正确答案：</strong>${escapeHtml(formatAnswer(question.correctAnswer))}</p>
            <p><strong>答案依据：</strong>${escapeHtml((question.evidence ?? []).join(' / '))}</p>
            <p><strong>解析：</strong>${escapeHtml(createChineseExplanation(question))}</p>
          </article>
        `;
      }).join('')}
    </section>
  `;
}
```

- [ ] **Step 5: Bind review-card click handlers**

Add review-card event binding so the active question changes after render:

```js
function bindReviewCards(app, session, uiState) {
  if (typeof app.querySelectorAll !== 'function') {
    return;
  }

  for (const card of app.querySelectorAll('[data-review-card]')) {
    card.addEventListener('click', () => {
      initializeSessionView(app, session, {
        ...uiState,
        activeQuestionId: card.dataset.questionId,
      });
    });
  }
}
```

- [ ] **Step 6: Run the targeted review test to verify it passes**

Run:

```bash
node --test tests/runtime/reading-ui-app.test.mjs
```

Expected: PASS for the new review tests plus the existing fetch-fallback and malformed-review tests.

- [ ] **Step 7: Commit**

```bash
git add runtime/ui/reading/app.js tests/runtime/reading-ui-app.test.mjs
git commit -m "feat: refine reading review rendering"
```

---

### Task 3: Strengthen the visual contract for review states and evidence highlighting

**Files:**
- Modify: `runtime/ui/reading/styles.css`
- Modify: `tests/runtime/reading-ui-server.test.mjs`

- [ ] **Step 1: Add a failing CSS asset test for the new review selectors**

In `tests/runtime/reading-ui-server.test.mjs`, extend the existing asset-copy test:

```js
test('shared reading UI assets are copied into the project', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-ui-'));
  const result = await copyReadingUiAssets(projectDir);

  const css = await readFile(result.stylesFile, 'utf8');
  assert.match(css, /\.passage-highlight/u);
  assert.match(css, /\.status-badge--wrong/u);
  assert.match(css, /\.review-card--active/u);
});
```

- [ ] **Step 2: Run the targeted CSS/server test to verify it fails**

Run:

```bash
node --test tests/runtime/reading-ui-server.test.mjs
```

Expected: FAIL because `runtime/ui/reading/styles.css` does not yet define `.passage-highlight`, `.status-badge--wrong`, or `.review-card--active`.

- [ ] **Step 3: Add stronger review styles**

In `runtime/ui/reading/styles.css`, add the new selectors:

```css
.review-panel,
.review-card {
  display: grid;
  gap: var(--space-3);
}

.review-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 700;
}

.status-badge--correct {
  background: rgba(31, 157, 85, 0.18);
  color: #7ef0ad;
}

.status-badge--wrong {
  background: rgba(214, 69, 69, 0.2);
  color: #ff9f9f;
}

.status-badge--unanswered {
  background: rgba(196, 139, 24, 0.2);
  color: #ffd67a;
}

.review-card--active {
  border: 2px solid var(--color-accent);
  box-shadow: 0 0 0 2px rgba(97, 218, 251, 0.15);
}

.passage-highlight {
  padding: 0 2px;
  border-radius: 4px;
  background: rgba(97, 218, 251, 0.3);
  color: #ffffff;
}
```

- [ ] **Step 4: Run the targeted server/css test to verify it passes**

Run:

```bash
node --test tests/runtime/reading-ui-server.test.mjs
```

Expected: PASS, including the asset-copy assertion for the new review selectors.

- [ ] **Step 5: Commit**

```bash
git add runtime/ui/reading/styles.css tests/runtime/reading-ui-server.test.mjs
git commit -m "style: emphasize reading review states"
```

---

### Task 4: Run final regression and confirm spec coverage

**Files:**
- Modify: none
- Test: `tests/runtime/reading-ui-app.test.mjs`
- Test: `tests/runtime/reading-ui-server.test.mjs`

- [ ] **Step 1: Run the focused review regression**

Run:

```bash
node --test tests/runtime/reading-ui-app.test.mjs tests/runtime/reading-ui-server.test.mjs
```

Expected: PASS with the refined review-layout tests, active-question tests, and CSS asset tests.

- [ ] **Step 2: Run the full repository test suite**

Run:

```bash
npm test
```

Expected: PASS with zero failures.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git --no-pager diff --stat HEAD~3..HEAD
```

Expected: only `runtime/ui/reading/app.js`, `runtime/ui/reading/styles.css`, `tests/runtime/reading-ui-app.test.mjs`, and `tests/runtime/reading-ui-server.test.mjs` changed for this refinement.

- [ ] **Step 4: Confirm plan-to-spec coverage**

Check each approved requirement against the completed tasks:

- passage remains visible in review mode → Task 2, Steps 3-6
- only active question evidence is highlighted → Task 1, Steps 2-4 and Task 2, Steps 2-6
- review states are visually obvious → Task 1, Steps 2-4 and Task 3, Steps 1-4
- explanation copy is Chinese → Task 1, Steps 2-4 and Task 2, Step 4

No extra commit is needed after this verification task if the previous task commits are already in place.
