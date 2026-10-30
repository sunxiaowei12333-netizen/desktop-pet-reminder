import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRigMesh, deformRig, RIGS } from '../src/pet-rig.js';

for (const id of Object.keys(RIGS)) {
  test(`${id}: all 288 phases preserve mesh orientation, UV material and the loop seam`, () => {
    const mesh = createRigMesh(id);
    const uv = new Float32Array(mesh.uv);
    const first = new Float32Array(deformRig(mesh, 0));
    assert.deepEqual(deformRig(mesh, 1), first);
    for (let phase = 0; phase < 288; phase++) {
      const v = deformRig(mesh, phase / 288), indices = mesh.indices;
      for (let i = 0; i < indices.length; i += 3) {
        const a=indices[i]*2, b=indices[i+1]*2, c=indices[i+2]*2;
        const area=(v[b]-v[a])*(v[c+1]-v[a+1])-(v[b+1]-v[a+1])*(v[c]-v[a]);
        assert.ok(area > .32, `${id} folded at phase ${phase} triangle ${i/3}`);
      }
    }
    assert.deepEqual(mesh.uv, uv, 'fur coordinates must never be regenerated');
    const before=new Float32Array(deformRig(mesh,1-1e-5)), after=new Float32Array(deformRig(mesh,1e-5));
    assert.ok(Math.max(...before.map((v,i)=>Math.abs(v-after[i]))) < .01, 'loop seam must be continuous');
  });
}
