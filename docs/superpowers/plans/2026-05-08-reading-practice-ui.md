# Reading Practice UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based reading practice flow that `ielts-reading` can launch by default for repository-generated reading sets, then score, review, and persist attempts locally.

**Architecture:** Extend the existing Node runtime so it can persist reading sets and reading attempts in `.ielts/`, derive raw score plus estimated GT Band, and serve one shared browser UI shell for practice and review. Update `ielts-reading/SKILL.md` so eligible “给我一套阅读题” requests prefer the browser flow and fall back to CLI when the UI cannot be launched.

**Tech Stack:** Node.js ESM, built-in `node:test`, existing runtime storage/schema modules, static HTML/CSS/JavaScript assets served locally, Markdown skill prompts.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `runtime/storage.mjs` | Modify | Add paths and persistence helpers for reading sets, reading attempts, and reading UI assets |
| `runtime/schema.mjs` | Modify | Add schemas for reading set payloads, reading answers, and reading result payloads |
| `runtime/reading-band.mjs` | Create | Convert scaled GT reading raw scores into estimated IELTS Band values |
| `runtime/reading-result.mjs` | Create | Compare submitted answers with answer key and produce review-ready per-question results |
| `runtime/reading-ui-server.mjs` | Create | Serve the persisted shared UI shell and reading session payloads in a local browser |
| `runtime/ieltsctl.mjs` | Modify | Add reading-specific commands for writing a set, launching UI, submitting answers, and loading review data |
| `runtime/ui/reading/index.html` | Create | Shared browser shell for reading practice and review |
| `runtime/ui/reading/app.js` | Create | Client-side rendering and submit/review flow |
| `runtime/ui/reading/styles.css` | Create | Project-persisted visual system for consistent reading UI launches |
| `ielts-reading/SKILL.md` | Modify | Route supported reading-practice requests into the browser UI flow, with CLI fallback |
| `README.md` | Modify | Document the reading UI flow and explain when the browser opens |
| `tests/runtime/reading-band.test.mjs` | Create | Lock GT Band estimation behavior for shortened sets |
| `tests/runtime/reading-result.test.mjs` | Create | Lock answer comparison, unanswered handling, and review payload shape |
| `tests/runtime/reading-ui-server.test.mjs` | Create | Verify UI launch payloads and persisted-asset usage |
| `tests/runtime/ieltsctl-reading.test.mjs` | Create | Verify CLI reading commands and project-local persistence |
| `tests/skills/skill-contract.test.mjs` | Modify | Lock reading-skill UI routing and fallback wording |

---

### Task 1: Add reading-set persistence and schemas

**Files:**
- Modify: `runtime/storage.mjs`
- Modify: `runtime/schema.mjs`
- Test: `tests/runtime/ieltsctl-reading.test.mjs`

- [ ] **Step 1: Write the failing schema/storage test**

Create `tests/runtime/ieltsctl-reading.test.mjs` with a first test that proves a reading set can be persisted under `.ielts/reading/sets/`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile } from 'node:fs/promises';
import { initProject, getPaths, writeJson } from '../../runtime/storage.mjs';
import { readingSetSchema } from '../../runtime/schema.mjs';

test('reading set payload can be persisted in project storage', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-project-'));
  await initProject(projectDir);

  const paths = getPaths(projectDir);
  const payload = readingSetSchema.parse({
    id: 'set-001',
    source: 'generated',
    examType: 'general-training',
    title: 'Community notice pack',
    passage: {
      title: 'Community Centre Renovation Guide',
      body: 'A short placeholder passage body.'
    },
    questions: [
      {
        id: 'q1',
        type: 'true-false-not-given',
        prompt: 'The centre closes every Monday.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answerKey: 'FALSE',
        evidence: ['The centre is open every day except public holidays.'],
        paraphrasePairs: [
          { prompt: 'closes every Monday', passage: 'open every day' }
        ],
        explanation: 'The passage explicitly says the opposite.'
      }
    ]
  });

  const targetFile = path.join(paths.readingSetsDir, `${payload.id}.json`);
  await writeJson(targetFile, payload);

  const written = JSON.parse(await readFile(targetFile, 'utf8'));
  assert.equal(written.id, 'set-001');
  assert.equal(written.examType, 'general-training');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/runtime/ieltsctl-reading.test.mjs
```

Expected: FAIL because `readingSetSchema` and `readingSetsDir` do not exist yet.

- [ ] **Step 3: Add reading paths to storage**

In `runtime/storage.mjs`, extend `getPaths()` so it returns reading-specific directories:

```js
readingDir: path.join(dataDir, 'reading'),
readingSetsDir: path.join(dataDir, 'reading', 'sets'),
readingAttemptsDir: path.join(dataDir, 'reading', 'attempts'),
readingUiDir: path.join(dataDir, 'reading', 'ui'),
```

Also update `initProject()` so these directories are created:

```js
await mkdir(paths.readingSetsDir, { recursive: true });
await mkdir(paths.readingAttemptsDir, { recursive: true });
await mkdir(paths.readingUiDir, { recursive: true });
```

- [ ] **Step 4: Add reading schemas**

In `runtime/schema.mjs`, add focused reading schemas:

```js
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
```

- [ ] **Step 5: Run the targeted test to verify it passes**

Run:

```bash
npm test -- tests/runtime/ieltsctl-reading.test.mjs
```

Expected: PASS for `reading set payload can be persisted in project storage`.

- [ ] **Step 6: Commit**

```bash
git add runtime/storage.mjs runtime/schema.mjs tests/runtime/ieltsctl-reading.test.mjs
git commit -m "feat: add reading set storage schema"
```

---

### Task 2: Derive reading score and review results

**Files:**
- Create: `runtime/reading-band.mjs`
- Create: `runtime/reading-result.mjs`
- Create: `tests/runtime/reading-band.test.mjs`
- Create: `tests/runtime/reading-result.test.mjs`

- [ ] **Step 1: Write the failing GT Band estimation test**

Create `tests/runtime/reading-band.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateGtBandFromShortSet } from '../../runtime/reading-band.mjs';

test('GT reading Band estimate scales a 10-question set to a 40-question equivalent', () => {
  const result = estimateGtBandFromShortSet({ correct: 8, total: 10 });

  assert.equal(result.scaledCorrect, 32);
  assert.equal(result.band, 7.5);
  assert.match(result.label, /estimated/i);
});
```

- [ ] **Step 2: Write the failing review-result derivation test**

Create `tests/runtime/reading-result.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveReadingResult } from '../../runtime/reading-result.mjs';

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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
npm test -- tests/runtime/reading-band.test.mjs tests/runtime/reading-result.test.mjs
```

Expected: FAIL because both runtime modules are missing.

- [ ] **Step 4: Implement GT Band estimation**

Create `runtime/reading-band.mjs`:

```js
const gtBands = [
  { min: 39, band: 9.0 },
  { min: 37, band: 8.5 },
  { min: 35, band: 8.0 },
  { min: 32, band: 7.5 },
  { min: 30, band: 7.0 },
  { min: 27, band: 6.5 },
  { min: 23, band: 6.0 },
  { min: 19, band: 5.5 },
  { min: 15, band: 5.0 },
];

export function estimateGtBandFromShortSet({ correct, total }) {
  const scaledCorrect = Math.round((correct / total) * 40);
  const match = gtBands.find((row) => scaledCorrect >= row.min) ?? { band: 4.5 };

  return {
    scaledCorrect,
    band: match.band,
    label: `Estimated Band ${match.band}`,
  };
}
```

- [ ] **Step 5: Implement review-result derivation**

Create `runtime/reading-result.mjs`:

```js
import { estimateGtBandFromShortSet } from './reading-band.mjs';

function normalizeAnswer(answer) {
  return typeof answer === 'string' ? answer.trim() : answer;
}

export function deriveReadingResult({ examType, questions, answers }) {
  const derivedQuestions = questions.map((question) => {
    const userAnswer = normalizeAnswer(answers[question.id] ?? '');
    const correctAnswer = normalizeAnswer(question.answerKey);
    const unanswered = userAnswer === '';
    const isCorrect = !unanswered && userAnswer === correctAnswer;

    return {
      questionId: question.id,
      questionType: question.type,
      userAnswer: unanswered ? null : userAnswer,
      correctAnswer,
      isCorrect,
      status: unanswered ? 'unanswered' : isCorrect ? 'correct' : 'wrong',
      evidence: question.evidence,
      paraphrasePairs: question.paraphrasePairs,
      explanation: question.explanation,
    };
  });

  const correct = derivedQuestions.filter((question) => question.isCorrect).length;
  const rawScore = { correct, total: derivedQuestions.length };
  const bandEstimate =
    examType === 'general-training'
      ? estimateGtBandFromShortSet(rawScore)
      : { scaledCorrect: null, band: null, label: 'Estimated Band unavailable' };

  return {
    rawScore,
    bandEstimate,
    questions: derivedQuestions,
  };
}
```

- [ ] **Step 6: Run the targeted tests to verify they pass**

Run:

```bash
npm test -- tests/runtime/reading-band.test.mjs tests/runtime/reading-result.test.mjs
```

Expected: PASS for both tests.

- [ ] **Step 7: Commit**

```bash
git add runtime/reading-band.mjs runtime/reading-result.mjs tests/runtime/reading-band.test.mjs tests/runtime/reading-result.test.mjs
git commit -m "feat: derive reading score and review results"
```

---

### Task 3: Add the shared browser UI shell and local reading server

**Files:**
- Create: `runtime/reading-ui-server.mjs`
- Create: `runtime/ui/reading/index.html`
- Create: `runtime/ui/reading/app.js`
- Create: `runtime/ui/reading/styles.css`
- Create: `tests/runtime/reading-ui-server.test.mjs`

- [ ] **Step 1: Write the failing server/UI-shell test**

Create `tests/runtime/reading-ui-server.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile } from 'node:fs/promises';
import { ensureReadingUiAssets } from '../../runtime/reading-ui-server.mjs';

test('shared reading UI assets are persisted into the project', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-ui-'));
  const result = await ensureReadingUiAssets(projectDir);

  const css = await readFile(result.stylesFile, 'utf8');
  assert.match(css, /--color-correct/u);
  assert.match(css, /\.reading-layout/u);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/runtime/reading-ui-server.test.mjs
```

Expected: FAIL because `ensureReadingUiAssets` does not exist.

- [ ] **Step 3: Create the shared browser shell**

Create `runtime/ui/reading/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>IELTS Reading Practice</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="app" class="reading-shell"></div>
    <script type="module" src="/app.js"></script>
  </body>
</html>
```

Create `runtime/ui/reading/styles.css` with stable tokens:

```css
:root {
  --color-bg: #0b1020;
  --color-panel: #151d33;
  --color-text: #eef2ff;
  --color-muted: #9aa6c4;
  --color-accent: #61dafb;
  --color-correct: #1f9d55;
  --color-wrong: #d64545;
  --color-unanswered: #c48b18;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
}

.reading-layout {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: var(--space-6);
}
```

- [ ] **Step 4: Create the browser app entry**

Create `runtime/ui/reading/app.js`:

```js
async function loadSession() {
  const response = await fetch('/session');
  return response.json();
}

function renderSummary(result) {
  return `
    <section class="score-card">
      <h2>${result.rawScore.correct}/${result.rawScore.total}</h2>
      <p>${result.bandEstimate.label}</p>
    </section>
  `;
}

loadSession().then((session) => {
  document.querySelector('#app').innerHTML = session.view === 'review'
    ? renderSummary(session.result)
    : '<div class="reading-layout"></div>';
});
```

- [ ] **Step 5: Create the local server and asset persistence helper**

Create `runtime/reading-ui-server.mjs`:

```js
import path from 'node:path';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { getPaths } from './storage.mjs';

export async function ensureReadingUiAssets(projectDir) {
  const paths = getPaths(projectDir);
  const targetDir = paths.readingUiDir;
  await mkdir(targetDir, { recursive: true });

  const sourceDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'ui', 'reading');
  const indexFile = path.join(targetDir, 'index.html');
  const appFile = path.join(targetDir, 'app.js');
  const stylesFile = path.join(targetDir, 'styles.css');

  await copyFile(path.join(sourceDir, 'index.html'), indexFile);
  await copyFile(path.join(sourceDir, 'app.js'), appFile);
  await copyFile(path.join(sourceDir, 'styles.css'), stylesFile);

  return { indexFile, appFile, stylesFile, targetDir };
}

export async function startReadingUiServer({ projectDir, sessionPayload }) {
  const assets = await ensureReadingUiAssets(projectDir);

  const server = createServer(async (request, response) => {
    if (request.url === '/session') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(sessionPayload));
      return;
    }

    const fileName = request.url === '/styles.css' ? assets.stylesFile : request.url === '/app.js' ? assets.appFile : assets.indexFile;
    response.end(await readFile(fileName));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}
```

- [ ] **Step 6: Run the targeted test to verify it passes**

Run:

```bash
npm test -- tests/runtime/reading-ui-server.test.mjs
```

Expected: PASS for shared UI asset persistence.

- [ ] **Step 7: Commit**

```bash
git add runtime/reading-ui-server.mjs runtime/ui/reading/index.html runtime/ui/reading/app.js runtime/ui/reading/styles.css tests/runtime/reading-ui-server.test.mjs
git commit -m "feat: add shared reading browser UI shell"
```

---

### Task 4: Add reading CLI commands for UI launch and submission

**Files:**
- Modify: `runtime/ieltsctl.mjs`
- Modify: `runtime/storage.mjs`
- Modify: `runtime/schema.mjs`
- Test: `tests/runtime/ieltsctl-reading.test.mjs`

- [ ] **Step 1: Add a failing command test for reading result persistence**

Append to `tests/runtime/ieltsctl-reading.test.mjs`:

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('ieltsctl record-reading-result persists a scored reading attempt', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-cli-'));
  await initProject(projectDir);

  const payloadFile = path.join(projectDir, 'reading-result.json');
  await writeJson(payloadFile, {
    setId: 'set-001',
    examType: 'general-training',
    rawScore: { correct: 8, total: 10 },
    bandEstimate: { scaledCorrect: 32, band: 7.5, label: 'Estimated Band 7.5' },
    questions: []
  });

  await execFileAsync('node', [
    'runtime/ieltsctl.mjs',
    'record-reading-result',
    '--project', projectDir,
    '--payload-file', payloadFile
  ]);

  const stored = JSON.parse(
    await readFile(path.join(projectDir, '.ielts', 'reading', 'attempts', 'set-001.json'), 'utf8')
  );
  assert.equal(stored.rawScore.correct, 8);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/runtime/ieltsctl-reading.test.mjs
```

Expected: FAIL because `record-reading-result` is unsupported.

- [ ] **Step 3: Add reading-result persistence helpers**

In `runtime/storage.mjs`, add:

```js
export async function writeReadingAttempt(projectDir, result) {
  const paths = getPaths(projectDir);
  const filePath = path.join(paths.readingAttemptsDir, `${result.setId}.json`);
  await writeJson(filePath, result);
  return filePath;
}
```

- [ ] **Step 4: Add reading commands to `ieltsctl`**

In `runtime/ieltsctl.mjs`, add command branches like:

```js
if (command === 'record-reading-result') {
  const payloadFile = readOption('--payload-file');
  if (!payloadFile) {
    throw new Error('Missing required option: --payload-file');
  }

  await initProject(projectDir);
  const payload = readingResultSchema.parse(await readJson(path.resolve(payloadFile)));
  const filePath = await writeReadingAttempt(projectDir, payload);

  process.stdout.write(`${JSON.stringify({ ok: true, command, filePath }, null, 2)}\n`);
  return;
}
```

Add a launch command:

```js
if (command === 'launch-reading-ui') {
  const sessionFile = readOption('--session-file');
  const sessionPayload = await readJson(path.resolve(sessionFile));
  const server = await startReadingUiServer({ projectDir, sessionPayload });
  const address = server.address();
  process.stdout.write(`${JSON.stringify({ ok: true, url: `http://127.0.0.1:${address.port}` }, null, 2)}\n`);
  return;
}
```

- [ ] **Step 5: Run the targeted command test to verify it passes**

Run:

```bash
npm test -- tests/runtime/ieltsctl-reading.test.mjs
```

Expected: PASS for both reading-set persistence and `record-reading-result`.

- [ ] **Step 6: Commit**

```bash
git add runtime/ieltsctl.mjs runtime/storage.mjs runtime/schema.mjs tests/runtime/ieltsctl-reading.test.mjs
git commit -m "feat: add reading UI runtime commands"
```

---

### Task 5: Route `ielts-reading` into the browser flow and document it

**Files:**
- Modify: `ielts-reading/SKILL.md`
- Modify: `README.md`
- Modify: `tests/skills/skill-contract.test.mjs`

- [ ] **Step 1: Add the failing contract assertions first**

Extend `tests/skills/skill-contract.test.mjs` with assertions that the reading skill:

```js
assert.match(skill, /默认优先启用 UI/u);
assert.match(skill, /环境不支持.*退回 CLI/u);
assert.match(skill, /只接.*原创材料.*训练/u);
assert.match(skill, /共享.*UI shell/u);
```

Also add a README assertion:

```js
assert.match(readme, /默认优先启用 UI/u);
```

- [ ] **Step 2: Run the skill-contract test to verify it fails**

Run:

```bash
npm test -- tests/skills/skill-contract.test.mjs
```

Expected: FAIL because the new routing/UI-shell wording is not documented yet.

- [ ] **Step 3: Update `ielts-reading/SKILL.md`**

Add a short UI-routing block inside the original-material generation mode:

```md
### UI 优先训练路由

- 对“skill 自己生成原创材料并做题”的请求，默认优先启用 UI。
- 如果当前环境不能拉起本地浏览器 UI，退回 CLI 训练流，不报成功假象。
- 第一版只对这条原创材料训练链启用 UI；用户粘贴外部文章时，继续走终端分析模式。
- UI 必须复用项目内持久化的 shared UI shell，不允许每次临时生成不同样式。
```

- [ ] **Step 4: Update `README.md`**

Add a browser-flow note in the reading-generation section:

```md
- 对支持的环境，`ielts-reading` 默认优先启用 UI 做题页
- 如果环境不支持浏览器拉起，再退回 CLI
```

- [ ] **Step 5: Run the contract test to verify it passes**

Run:

```bash
npm test -- tests/skills/skill-contract.test.mjs
```

Expected: PASS with the new routing assertions.

- [ ] **Step 6: Commit**

```bash
git add ielts-reading/SKILL.md README.md tests/skills/skill-contract.test.mjs
git commit -m "feat: route reading practice through browser UI"
```

---

### Task 6: Run the full suite and verify plan coverage

**Files:**
- Modify: none
- Test: `npm test`

- [ ] **Step 1: Run the full suite**

Run:

```bash
npm test
```

Expected: PASS with the existing runtime and skill-contract tests plus the new reading UI coverage.

- [ ] **Step 2: Review the final feature diff**

Run:

```bash
git --no-pager diff --stat HEAD~5..HEAD
```

Expected: only the files listed in this plan appear in the final feature range.

- [ ] **Step 3: Verify plan-to-spec coverage before handoff**

Check that the final implementation covers:

```text
- UI launched through ielts-reading
- shared UI shell persisted in project
- GT estimated Band on review page
- direct submit -> review transition
- local persistence for sets, answers, and results
- CLI fallback when browser launch is unavailable
```

Expected: every spec item maps to one of Tasks 1-5 with no gaps.

