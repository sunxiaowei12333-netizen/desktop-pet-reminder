import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, lstatSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

test("macOS ZIP round-trip preserves framework Current and binary symlinks", { skip: process.platform !== "darwin" }, () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "rest-moment-archive-"));
  try {
    const app = path.join(temporary, "Test.app");
    const framework = path.join(app, "Contents/Frameworks/Test.framework");
    mkdirSync(path.join(framework, "Versions/A"), { recursive: true });
    writeFileSync(path.join(framework, "Versions/A/Test"), "framework payload");
    symlinkSync("A", path.join(framework, "Versions/Current"));
    symlinkSync("Versions/Current/Test", path.join(framework, "Test"));
    const archive = path.join(temporary, "test.zip"), restored = path.join(temporary, "restored");
    assert.equal(spawnSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", app, archive]).status, 0);
    assert.equal(spawnSync("ditto", ["-x", "-k", archive, restored]).status, 0);
    const copied = path.join(restored, "Test.app/Contents/Frameworks/Test.framework");
    assert.ok(lstatSync(path.join(copied, "Versions/Current")).isSymbolicLink());
    assert.ok(lstatSync(path.join(copied, "Test")).isSymbolicLink());
    assert.equal(readFileSync(path.join(copied, "Test"), "utf8"), "framework payload");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
