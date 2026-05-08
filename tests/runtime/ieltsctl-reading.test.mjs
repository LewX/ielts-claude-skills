import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { initProject, getPaths, writeJson } from '../../runtime/storage.mjs';
import { readingSetSchema } from '../../runtime/schema.mjs';

const execFileAsync = promisify(execFile);

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
      body: 'A short placeholder passage body.',
    },
    questions: [
      {
        id: 'q1',
        type: 'true-false-not-given',
        prompt: 'The centre closes every Monday.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answerKey: 'FALSE',
        evidence: ['The centre is open every day except public holidays.'],
        paraphrasePairs: [{ prompt: 'closes every Monday', passage: 'open every day' }],
        explanation: 'The passage explicitly says the opposite.',
      },
    ],
  });

  const targetFile = path.join(paths.readingSetsDir, `${payload.id}.json`);
  await writeJson(targetFile, payload);

  const written = JSON.parse(await readFile(targetFile, 'utf8'));
  assert.equal(written.id, 'set-001');
  assert.equal(written.examType, 'general-training');
});

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

test('ieltsctl launch-reading-ui rejects missing --session-file with a clear error', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-cli-'));
  await initProject(projectDir);

  await assert.rejects(
    execFileAsync('node', [
      'runtime/ieltsctl.mjs',
      'launch-reading-ui',
      '--project', projectDir
    ]),
    /Missing required option: --session-file/
  );
});

test('ieltsctl launch-reading-ui rejects malformed practice sessions', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-cli-'));
  await initProject(projectDir);

  const sessionFile = path.join(projectDir, 'reading-session.json');
  await writeJson(sessionFile, { view: 'practice' });

  await assert.rejects(
    execFileAsync(
      'node',
      [
        'runtime/ieltsctl.mjs',
        'launch-reading-ui',
        '--project', projectDir,
        '--session-file', sessionFile,
      ],
      { timeout: 1000 }
    ),
    /Malformed practice payload/
  );
});

test('ieltsctl launch-reading-ui prints machine-readable success output with the URL', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'ielts-reading-cli-'));
  await initProject(projectDir);

  const sessionFile = path.join(projectDir, 'reading-session.json');
  await writeJson(sessionFile, createPracticeSession());

  const child = spawn('node', [
    'runtime/ieltsctl.mjs',
    'launch-reading-ui',
    '--project', projectDir,
    '--session-file', sessionFile,
  ]);

  try {
    const stdout = await new Promise((resolve, reject) => {
      let output = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        output += chunk;
        if (/"ok"\s*:\s*true/u.test(output) && /"url"\s*:\s*"http:\/\/127\.0\.0\.1:\d+"/u.test(output)) {
          resolve(output);
        }
      });
      child.on('error', reject);
      child.on('exit', (code) => reject(new Error(`launch-reading-ui exited early with code ${code}`)));
    });

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.command, 'launch-reading-ui');
    assert.match(parsed.url, /^http:\/\/127\.0\.0\.1:\d+$/u);
  } finally {
    child.kill('SIGTERM');
  }
});
