#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { deriveProject } from './derive.mjs';
import { attemptSchema, readingResultSchema, readingUiSessionSchema } from './schema.mjs';
import { getPaths, initProject, readJson, writeAttempt, writeReadingAttempt } from './storage.mjs';
import { startReadingUiServer } from './reading-ui-server.mjs';

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = process.argv[index + 1];

  // Task 1 keeps parsing intentionally minimal: value-taking flags need a separate, non-flag token.
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

async function main() {
  const command = process.argv[2];
  const projectDir = path.resolve(readOption('--project') ?? process.cwd());

  if (command === 'init') {
    await initProject(projectDir);
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          command: 'init',
          projectDir,
        },
        null,
        2
      ) + '\n'
    );
    return;
  }

  if (command === 'record') {
    const payloadFile = readOption('--payload-file');

    if (!payloadFile) {
      throw new Error('Missing required option: --payload-file');
    }

    await initProject(projectDir);
    const attempt = attemptSchema.parse(await readJson(path.resolve(payloadFile)));

    await writeAttempt(projectDir, attempt);
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          command: 'record',
          projectDir,
          title: attempt.title,
        },
        null,
        2
      ) + '\n'
    );
    return;
  }

  if (command === 'derive') {
    await initProject(projectDir);
    process.stdout.write(`${JSON.stringify(await deriveProject(projectDir), null, 2)}\n`);
    return;
  }

  if (command === 'summary') {
    await initProject(projectDir);
    const paths = getPaths(projectDir);
    const summary = {
      stats: await readJson(paths.stats),
      weakSpots: await readJson(paths.weakSpots),
      nextStep: await readJson(paths.nextStep),
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

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

  if (command === 'launch-reading-ui') {
    const sessionFile = readOption('--session-file');
    if (!sessionFile) {
      throw new Error('Missing required option: --session-file');
    }

    await initProject(projectDir);

    const rawSessionPayload = await readJson(path.resolve(sessionFile));
    let sessionPayload;

    try {
      sessionPayload = readingUiSessionSchema.parse(rawSessionPayload);
    } catch {
      const view = rawSessionPayload?.view;
      const kind = view === 'practice' || view === 'review' ? `${view} ` : '';
      throw new Error(`Malformed ${kind}payload`);
    }

    const server = await startReadingUiServer({ projectDir, sessionPayload });
    const address = server.address();
    process.stdout.write(
      `${JSON.stringify({ ok: true, command, url: `http://127.0.0.1:${address.port}` }, null, 2)}\n`
    );
    return;
  }

  throw new Error(`Unsupported command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exit(1);
});
