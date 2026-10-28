import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleTimeline, framePlacement, paintSourceFrame } from '../src/pet-animation.js';

function rasterCanvas(width, height) {
  const pixels = new Uint8Array(width * height);
  return { pixels, globalAlpha: 1, globalCompositeOperation: 'source-over',
    clearRect() { pixels.fill(0); },
    drawImage(frame, x, y, drawWidth, drawHeight) {
      for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
        const sx = Math.floor((column - x) / drawWidth * frame.width);
        const sy = Math.floor((row - y) / drawHeight * frame.height);
        if (sx >= 0 && sy >= 0 && sx < frame.width && sy < frame.height && frame.pixels[sy * frame.width + sx]) {
          pixels[row * width + column] = Math.round(frame.pixels[sy * frame.width + sx] * this.globalAlpha);
        }
      }
    },
  };
}

test('a halfway timestamp paints one complete source pose, with no second-pose ghost', () => {
  const first = { width: 4, height: 1, pixels: [255, 0, 0, 0] };
  const second = { width: 4, height: 1, pixels: [0, 0, 0, 255] };
  const asset = { width: 4, height: 1, frames: [first, second] };
  const ctx = rasterCanvas(4, 1);
  paintSourceFrame(ctx, asset, sampleTimeline([140, 140], 70).index, 4, 1, 0, 'center');
  assert.deepEqual([...ctx.pixels], [255, 0, 0, 0]);
  paintSourceFrame(ctx, asset, sampleTimeline([140, 140], 141).index, 4, 1, 0, 'center');
  assert.deepEqual([...ctx.pixels], [0, 0, 0, 255], 'previous paw must be cleared completely');
});

test('source timing retains 22 frames and the original 3.08-second cycle', () => {
  const durations = Array(22).fill(140);
  assert.equal(sampleTimeline(durations, 3079).index, 21);
  assert.equal(sampleTimeline(durations, 3080).index, 0);
  assert.equal(sampleTimeline(durations, 3080 + 140).index, 1);
});

test('transparent margin removal moves the visible cat closer without scaling it', () => {
  const asset = { width: 448, height: 448, bounds: { left: 127, right: 320, top: 40, bottom: 420 } };
  const before = framePlacement(asset, 198, 216, .05, 'center');
  const after = framePlacement(asset, 198, 216, .05, 'left');
  assert.equal(after.scale, before.scale);
  assert.equal(after.width, before.width); assert.equal(after.height, before.height);
  assert.ok(after.x < before.x);
  assert.ok(Math.abs(after.x + asset.bounds.left * after.scale - 9.9) < .001);
  assert.ok(Math.abs(after.y + (asset.bounds.top + asset.bounds.bottom) / 2 * after.scale - 108) < .001);
  assert.ok(after.x + asset.bounds.right * after.scale < 198, 'cat must remain fully inside its window');
});
