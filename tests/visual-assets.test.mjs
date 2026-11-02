import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

test("legacy macOS icon has system-size artwork, transparent margins and rounded corners", async () => {
  const { data, info } = await sharp("assets/RestMoment.png").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1024); assert.equal(info.height, 1024);
  let left = 1024, right = 0, top = 1024, bottom = 0;
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) if (data[(y * 1024 + x) * 4 + 3] > 128) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  assert.deepEqual([left, top, right + 1, bottom + 1], [100, 100, 924, 924]);
  for (const [x, y] of [[0, 0], [100, 100], [923, 100], [100, 923], [923, 923]]) {
    assert.equal(data[(y * 1024 + x) * 4 + 3], 0);
  }
});

test("all six production sequences satisfy geometry, transparency and full-motion contracts", async () => {
  const { inspectSequenceAssets } = await import('../scripts/inspect-pet-sequences.mjs');
  const report = await inspectSequenceAssets();
  assert.deepEqual(report.checks.filter(check => !check.pass), []);
  assert.equal(Object.keys(report.actions).length, 6);
});
