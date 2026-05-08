import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

async function createProjectDir(testName) {
  return mkdtemp(
    path.join(
      tmpdir(),
      `${testName.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-`
    )
  );
}

test('ieltsctl summary reports derived writing stats, weak spots, and next steps', async (t) => {
  const projectDir = await createProjectDir('summary-derived-writing');
  const payloadPath = path.join(projectDir, 'writing-payload.json');

  assert.equal(path.dirname(projectDir), tmpdir());

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
        timestamp: '2026-04-28T11:00:00.000Z',
        title: 'Task 2 summary review',
        scores: {
          tr: 5,
          cc: 5.5,
          lr: 6,
          gra: 5.5,
          overall: 5.5,
        },
        summary: 'Needs fuller task coverage and more developed support.',
        findings: [
          {
            tag: 'task-response.missed-part',
            message: 'Missed one required part of the prompt.',
            severity: 'high',
          },
          {
            tag: 'task-response.missed-part',
            message: 'Missed one required part of the prompt.',
            severity: 'high',
          },
        ],
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

  await execFileAsync('node', ['runtime/ieltsctl.mjs', 'derive', '--project', projectDir]);

  const { stdout } = await execFileAsync('node', [
    'runtime/ieltsctl.mjs',
    'summary',
    '--project',
    projectDir,
  ]);
  const summary = JSON.parse(stdout);

  assert.equal(summary.stats.attemptCount, 1);
  assert.equal(summary.stats.latestWritingBand, 5.5);
  assert.equal(summary.weakSpots.topTags[0].tag, 'task-response.missed-part');
  assert.equal(summary.nextStep.focusSkill, 'ielts-writing');
});
