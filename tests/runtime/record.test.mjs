import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

async function createProjectDir(testName) {
  return mkdtemp(
    path.join(tmpdir(), `${testName.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-`)
  );
}

test('ieltsctl record persists a writing attempt, findings, and rewrite artifacts', async (t) => {
  const projectDir = await createProjectDir('record-writing-attempt');
  const payloadPath = path.join(projectDir, 'writing-payload.json');

  t.after(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  await mkdir(path.join(projectDir, '.git'), { recursive: true });

  await execFileAsync('node', ['runtime/ieltsctl.mjs', 'init', '--project', projectDir]);

  await writeFile(
    payloadPath,
    `${JSON.stringify(
        {
          skill: 'ielts-writing',
          mode: 'correction',
          timestamp: '2026-04-28T09:00:00.000Z',
          title: 'Task 2 opinion essay review',
          scores: {
            tr: 5,
            cc: 5.5,
            lr: 6,
            gra: 5.5,
            overall: 5.5,
          },
          summary: 'Addresses the topic but misses one side of the discussion and needs clearer development.',
          findings: [
            {
              tag: 'task-response.missed-part',
              message: 'Missed the discussion of both views.',
              severity: 'high',
            },
          ],
          artifacts: [
          {
            kind: 'rewrite',
            title: 'Band 6.5 rewrite',
            content: 'While practical skills deserve more classroom time, academic subjects still provide the foundation students need for future study and work.',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  const { stdout } = await execFileAsync('node', [
    'runtime/ieltsctl.mjs',
    'record',
    '--project',
    projectDir,
    '--payload-file',
    payloadPath,
  ]);

  assert.deepEqual(JSON.parse(stdout), {
    ok: true,
    command: 'record',
    projectDir,
    title: 'Task 2 opinion essay review',
  });

  const attemptDir = path.join(projectDir, '.ielts', 'attempts', '2026');
  const attemptFiles = await readdir(attemptDir);

  assert.equal(attemptFiles.length, 1);

  const attempt = JSON.parse(
    await readFile(path.join(attemptDir, attemptFiles[0]), 'utf8')
  );
  assert.deepEqual(attempt, {
    skill: 'ielts-writing',
    mode: 'correction',
    timestamp: '2026-04-28T09:00:00.000Z',
    title: 'Task 2 opinion essay review',
    scores: {
      tr: 5,
      cc: 5.5,
      lr: 6,
      gra: 5.5,
      overall: 5.5,
    },
    summary: 'Addresses the topic but misses one side of the discussion and needs clearer development.',
    findings: [
      {
        tag: 'task-response.missed-part',
        message: 'Missed the discussion of both views.',
        severity: 'high',
      },
    ],
    artifacts: [
      {
        kind: 'rewrite',
        title: 'Band 6.5 rewrite',
        content: 'While practical skills deserve more classroom time, academic subjects still provide the foundation students need for future study and work.',
      },
    ],
  });

  const inboxLines = (await readFile(path.join(projectDir, '.ielts', 'findings', 'inbox.jsonl'), 'utf8'))
    .trim()
    .split('\n');
  assert.deepEqual(JSON.parse(inboxLines[0]), {
    tag: 'task-response.missed-part',
    message: 'Missed the discussion of both views.',
    severity: 'high',
    skill: 'ielts-writing',
    timestamp: '2026-04-28T09:00:00.000Z',
    attemptTitle: 'Task 2 opinion essay review',
  });

  const rewriteLines = (await readFile(path.join(projectDir, '.ielts', 'artifacts', 'rewrites.jsonl'), 'utf8'))
    .trim()
    .split('\n');
  assert.deepEqual(JSON.parse(rewriteLines[0]), {
    kind: 'rewrite',
    title: 'Band 6.5 rewrite',
    content: 'While practical skills deserve more classroom time, academic subjects still provide the foundation students need for future study and work.',
    skill: 'ielts-writing',
    timestamp: '2026-04-28T09:00:00.000Z',
    attemptTitle: 'Task 2 opinion essay review',
  });
});

test('ieltsctl record lazily initializes the project scaffold', async (t) => {
  const projectDir = await createProjectDir('record-lazy-init');
  const payloadPath = path.join(projectDir, 'writing-payload.json');

  t.after(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  await mkdir(path.join(projectDir, '.git'), { recursive: true });
  await writeFile(
    payloadPath,
    `${JSON.stringify(
      {
        skill: 'ielts-writing',
        mode: 'correction',
        timestamp: '2026-04-28T10:00:00.000Z',
        title: 'Task 2 lazy init review',
        scores: {
          tr: 5,
          cc: 5.5,
          lr: 6,
          gra: 5.5,
          overall: 5.5,
        },
        summary: 'Initializes storage on first record call.',
        findings: [],
        artifacts: [],
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  await execFileAsync('node', [
    'runtime/ieltsctl.mjs',
    'record',
    '--project',
    projectDir,
    '--payload-file',
    payloadPath,
  ]);

  const attemptFiles = await readdir(path.join(projectDir, '.ielts', 'attempts', '2026'));
  assert.equal(attemptFiles.length, 1);
});
