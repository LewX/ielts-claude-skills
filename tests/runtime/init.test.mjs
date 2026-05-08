import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('ieltsctl init creates the phase-1 .ielts scaffold in a target project', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'ielts-init-'));
  await mkdir(path.join(projectDir, '.git'));

  await execFileAsync('node', [
    'runtime/ieltsctl.mjs',
    'init',
    '--project',
    projectDir,
  ]);

  const expectedFiles = [
    '.ielts/profile.json',
    '.ielts/findings/inbox.jsonl',
    '.ielts/artifacts/rewrites.jsonl',
    '.ielts/artifacts/speaking-stories.jsonl',
    '.ielts/artifacts/synonyms.jsonl',
    '.ielts/derived/stats.json',
    '.ielts/derived/weak-spots.json',
    '.ielts/derived/next-step.json',
  ];
  const expectedDirectories = ['.ielts/attempts', '.ielts/backups'];

  for (const relativePath of expectedFiles) {
    const fullPath = path.join(projectDir, relativePath);
    const fileStat = await stat(fullPath);
    assert.equal(fileStat.isFile(), true, `${relativePath} should exist`);
  }

  for (const relativePath of expectedDirectories) {
    const fullPath = path.join(projectDir, relativePath);
    const directoryStat = await stat(fullPath);
    assert.equal(directoryStat.isDirectory(), true, `${relativePath} should exist`);
  }

  const profile = JSON.parse(
    await readFile(path.join(projectDir, '.ielts/profile.json'), 'utf8')
  );

  assert.deepEqual(profile, {
    targetBand: null,
    examDate: null,
    currentLevel: {},
    preferences: {},
  });
});

test('ieltsctl init rejects --project when no value follows it', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'ielts-init-missing-project-'));
  await mkdir(path.join(projectDir, '.git'));

  await assert.rejects(
    execFileAsync(
      'node',
      [path.resolve('runtime/ieltsctl.mjs'), 'init', '--project'],
      { cwd: projectDir }
    ),
    /Missing value for --project/
  );
});

test('ieltsctl bin target exists and is executable', async () => {
  const packageJson = JSON.parse(await readFile(path.resolve('package.json'), 'utf8'));
  const binTarget = packageJson.bin?.ieltsctl;

  assert.equal(typeof binTarget, 'string');

  const targetPath = path.resolve(binTarget);
  const targetStat = await stat(targetPath);

  assert.equal(targetStat.isFile(), true);
  await access(targetPath, constants.X_OK);
});

test('package manifests include zod for runtime schema validation', async () => {
  const packageJson = JSON.parse(await readFile(path.resolve('package.json'), 'utf8'));
  const packageLock = JSON.parse(await readFile(path.resolve('package-lock.json'), 'utf8'));

  assert.equal(packageJson.dependencies?.zod, '^3.24.4');
  assert.equal(packageLock.packages?.['']?.dependencies?.zod, '^3.24.4');
  assert.equal(packageLock.packages?.['node_modules/zod']?.version, '3.24.4');
});
