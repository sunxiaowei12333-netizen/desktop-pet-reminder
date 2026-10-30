import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root='src/assets/nailao/';
const metadata=JSON.parse(readFileSync(root+'rig/manifest.json'));
for(const [id,spec] of Object.entries(metadata.actions)) {
  test(`${id}: immutable rig texture and exported GIF match their manifest`, async()=>{
    const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
    const texture=root+`rig/rig-${id}.png`;
    assert.equal(sha(texture),spec.textureSha256);
    assert.equal(sha(root+`nailao-action-${id}-image2.gif`),spec.gifSha256);
    const info=await sharp(texture).metadata();
    assert.equal(info.width,448);assert.equal(info.height,448);assert.equal(info.hasAlpha,true);
    assert.equal(metadata.durationMs,4800);assert.equal(metadata.exportFps,25);
  });
}
