import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateGtBandFromShortSet } from '../../runtime/reading-band.mjs';

test('GT reading Band estimate scales a 10-question set to a 40-question equivalent', () => {
  const result = estimateGtBandFromShortSet({ correct: 8, total: 10 });

  assert.equal(result.scaledCorrect, 32);
  assert.equal(result.band, 7.5);
  assert.match(result.label, /estimated/i);
});
