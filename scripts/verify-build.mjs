import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { petActionIds } from "./pet-action-manifest.mjs";

const manifest = JSON.parse(readFileSync("dist/pet-actions.json", "utf8"));
assert.deepEqual(Object.keys(manifest).sort(), [...petActionIds].sort());
for (const id of petActionIds) {
  assert.ok(manifest[id].startsWith("assets/") && !manifest[id].includes(".."));
  const file = path.join("dist", manifest[id]);
  assert.ok(existsSync(file), `Missing action ${id}: ${file}`);
  assert.match(readFileSync(file).subarray(0, 6).toString(), /^GIF8[79]a$/);
}
assert.equal(readFileSync("assets/RestMoment.icns").subarray(0, 4).toString(), "icns");
assert.ok(existsSync("dist/index.html"));
console.log("Build verified: all six hashed action URLs resolve, and the macOS icon is present.");
