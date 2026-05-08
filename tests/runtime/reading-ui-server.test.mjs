import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, unlink } from 'node:fs/promises';
import { copyReadingUiAssets, startReadingUiServer } from '../../runtime/reading-ui-server.mjs';

async function get(server, urlPath) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${urlPath}`);
  return res;
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
      ],
    },
  };
}

test('shared reading UI assets are copied into the project', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-ui-'));
  const result = await copyReadingUiAssets(projectDir);

  const css = await readFile(result.stylesFile, 'utf8');
  assert.match(css, /--color-correct/u);
  assert.match(css, /\.reading-layout/u);
  assert.match(css, /\.passage-highlight/u);
  assert.match(css, /\.status-badge--wrong/u);
  assert.match(css, /\.review-card--active/u);
});

test('server serves index.html with text/html content-type', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-ui-'));
  const server = await startReadingUiServer({ projectDir, sessionPayload: {} });
  try {
    const res = await get(server, '/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/u);
    const body = await res.text();
    assert.match(body, /IELTS Reading Practice/u);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('server serves app.js with text/javascript content-type', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-ui-'));
  const server = await startReadingUiServer({ projectDir, sessionPayload: {} });
  try {
    const res = await get(server, '/app.js');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/javascript/u);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('server serves styles.css with text/css content-type', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-ui-'));
  const server = await startReadingUiServer({ projectDir, sessionPayload: {} });
  try {
    const res = await get(server, '/styles.css');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/css/u);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('server serves /session with sessionPayload as JSON', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-ui-'));
  const sessionPayload = { passageId: 'p1', title: 'Test Passage' };
  const server = await startReadingUiServer({ projectDir, sessionPayload });
  try {
    const res = await get(server, '/session');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/u);
    const body = await res.json();
    assert.deepEqual(body, sessionPayload);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('server grades submitted practice answers and persists the result', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-ui-'));
  const server = await startReadingUiServer({ projectDir, sessionPayload: createPracticeSession() });
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        answers: { q1: 'FALSE' },
      }),
    });

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/u);

    const body = await res.json();
    assert.equal(body.rawScore.correct, 1);
    assert.equal(body.rawScore.total, 1);
    assert.match(body.bandEstimate.label, /Estimated Band/u);

    const { getPaths } = await import('../../runtime/storage.mjs');
    const { readingAttemptsDir } = getPaths(projectDir);
    const persisted = JSON.parse(await readFile(path.join(readingAttemptsDir, 'set-001.json'), 'utf8'));
    assert.equal(persisted.rawScore.correct, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('server returns 500 when an asset file cannot be read', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-ui-'));
  const server = await startReadingUiServer({ projectDir, sessionPayload: {} });

  // Delete the index.html that was copied to the project so the next request fails
  const { getPaths } = await import('../../runtime/storage.mjs');
  const { readingUiDir } = getPaths(projectDir);
  await unlink(path.join(readingUiDir, 'index.html'));

  try {
    const res = await get(server, '/');
    assert.equal(res.status, 500);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
