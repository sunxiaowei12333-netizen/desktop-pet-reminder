import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { petActionIds } from "./pet-action-manifest.mjs";

const manifest = JSON.parse(readFileSync("dist/pet-actions.json", "utf8"));
const rig = JSON.parse(readFileSync("dist/pet-rig.json", "utf8"));
const metadata = JSON.parse(readFileSync("src/assets/nailao/rig/manifest.json", "utf8"));
assert.deepEqual(Object.keys(manifest).sort(), [...petActionIds].sort());
for (const id of petActionIds) {
  assert.ok(manifest[id].startsWith("assets/") && !manifest[id].includes(".."));
  const file = path.join("dist", manifest[id]);
  assert.ok(existsSync(file), `Missing action ${id}: ${file}`);
  assert.match(readFileSync(file).subarray(0, 6).toString(), /^GIF8[79]a$/);
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), metadata.actions[id].gifSha256);
  assert.ok(rig[id].startsWith("assets/") && !rig[id].includes(".."));
  const atlas = readFileSync(path.join("dist", rig[id]));
  assert.equal(createHash('sha256').update(atlas).digest('hex'), metadata.actions[id].textureSha256);
}
assert.equal(readFileSync("assets/RestMoment.icns").subarray(0, 4).toString(), "icns");
assert.ok(existsSync("dist/index.html"));
console.log("Build verified: six poses, six immutable rig textures, and the macOS icon are present.");
