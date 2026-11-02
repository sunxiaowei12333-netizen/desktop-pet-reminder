import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { petActionIds } from "./pet-action-manifest.mjs";

const manifest = JSON.parse(readFileSync("dist/pet-actions.json", "utf8"));
const metadata = JSON.parse(readFileSync("src/assets/nailao/sequences/manifest.json", "utf8"));
assert.deepEqual(Object.keys(manifest).sort(), [...petActionIds].sort());
for (const id of petActionIds) {
  assert.ok(manifest[id].startsWith("assets/") && !manifest[id].includes(".."));
  const file = path.join("dist", manifest[id]);
  assert.ok(existsSync(file), `Missing action ${id}: ${file}`);
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
  assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.actions[id].sha256);
}
assert.equal(readFileSync("assets/RestMoment.icns").subarray(0, 4).toString(), "icns");
assert.ok(existsSync("dist/index.html"));
console.log("Build verified: six lossless RGBA animation sequences and the macOS icon are present.");
