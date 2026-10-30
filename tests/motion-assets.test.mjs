import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { motionSample } from '../src/pet-motion-renderer.js';
const root = 'src/assets/nailao/';
const metadata = JSON.parse(readFileSync(root + 'motion-manifest.json'));

test('motion transitions choose one solid source pose and invert only its displacement', () => {
  assert.deepEqual(motionSample({ index: 3, next: 4, mix: .25 }), { source: 3, field: 6, amount: .25 });
  assert.deepEqual(motionSample({ index: 3, next: 4, mix: .75 }), { source: 4, field: 7, amount: .25 });
  assert.deepEqual(motionSample({ index: 15, next: 0, mix: .9 }), { source: 0, field: 31, amount: 1 - .9 });
});

for (const [id, spec] of Object.entries(metadata)) {
  test(`${id} motion atlas includes both directions for all poses and matches the actual GIF`, async () => {
    const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
    assert.equal(sha(root + `nailao-action-${id}-image2.gif`), spec.sourceSha256, 'regenerate motion maps after changing a pose');
    assert.equal(sha(root + `motion-${id}.png`), spec.atlasSha256);
    const info = await sharp(root + `motion-${id}.png`).metadata();
    assert.equal(spec.pairs, 16);
    assert.equal(info.width, spec.columns * spec.gridSize);
    assert.equal(info.height, Math.ceil(spec.pairs * 2 / spec.columns) * spec.gridSize);
    assert.ok(spec.range > 0 && spec.range <= 128);
  });
}
