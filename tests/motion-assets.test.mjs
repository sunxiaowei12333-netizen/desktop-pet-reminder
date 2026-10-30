import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root = 'src/assets/nailao/';
const metadata = JSON.parse(readFileSync(root + 'motion-manifest.json'));

for (const [id, spec] of Object.entries(metadata)) {
  test(`${id} motion atlas includes both directions for all poses and matches the actual GIF`, async () => {
    const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
    assert.equal(sha(root + `nailao-action-${id}-image2.gif`), spec.sourceSha256, 'regenerate motion maps after changing a pose');
    assert.equal(sha(root + `motion-${id}.png`), spec.atlasSha256);
    const info = await sharp(root + `motion-${id}.png`).metadata();
    assert.equal(spec.pairs, 16);
    assert.equal(spec.flowSmoothingSigma, 2);
    assert.equal(spec.occlusionConfidence, true);
    const { data } = await sharp(root + `motion-${id}.png`).raw().toBuffer({ resolveWithObject: true });
    let protectedPixels = 0, stablePixels = 0;
    for (let i = 2; i < data.length; i += 3) { if (data[i] === 0) protectedPixels++; if (data[i] === 255) stablePixels++; }
    assert.ok(protectedPixels > 1000 && stablePixels > 1000, "must contain internal-edge protection and stable material regions");
    assert.equal(info.width, spec.columns * spec.gridSize);
    assert.equal(info.height, Math.ceil(spec.pairs * 2 / spec.columns) * spec.gridSize);
    assert.ok(spec.range > 0 && spec.range <= 128);
  });
}
