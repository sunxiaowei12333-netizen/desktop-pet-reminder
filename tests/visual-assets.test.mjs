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

for (const id of ["wave", "rest", "look", "stretch", "companion", "blink"]) {
  test(`${id}: all 16 decoded GIF frames retain safe bounds and contain no green spill`, async () => {
    const file = `src/assets/nailao/nailao-action-${id}-image2.gif`;
    const metadata = await sharp(file, { animated: true }).metadata();
    assert.equal(metadata.pages, 16);
    assert.equal(metadata.delay.reduce((a, b) => a + b, 0), 3200);
    const { data, info } = await sharp(file, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const height = info.height / 16;
    const areas = [], bottoms = [], widths = [];
    for (let frame = 0; frame < 16; frame++) {
      let visible = 0, bottom = 0, left = info.width, right = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < info.width; x++) {
        const i = ((frame * height + y) * info.width + x) * 4;
        if (data[i + 3] <= 128) continue;
        visible++; bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
        assert.ok(x >= 24 && y >= 24 && x < info.width - 24 && y < height - 24, `cropped ${id} frame ${frame}`);
        assert.ok(data[i + 1] - Math.max(data[i], data[i + 2]) <= 8, `green ${id} frame ${frame}`);
      }
      areas.push(visible); bottoms.push(bottom); widths.push(right - left + 1);
      assert.ok(visible > 10000, `empty ${id} frame ${frame}`);
    }
    assert.ok(Math.sqrt(Math.max(...areas) / Math.min(...areas)) - 1 < .01, `${id} changes overall cat scale within one action`);
    assert.ok(Math.max(...bottoms) - Math.min(...bottoms) <= 4, `${id} ground baseline drifts`);
    if (id === 'stretch') assert.ok(Math.max(...widths) / Math.min(...widths) > 1.4, 'scale correction must preserve the extended stretch pose');
  });
}
