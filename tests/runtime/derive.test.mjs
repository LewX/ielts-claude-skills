import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('derive documents the phase-1 writing-first next step limitation', async () => {
  const source = await readFile(new URL('../../runtime/derive.mjs', import.meta.url), 'utf8');

  assert.match(
    source,
    /Phase 1[\s\S]{0,120}writing-first MVP[\s\S]{0,120}focusSkill:\s*'ielts-writing'/i
  );
});
