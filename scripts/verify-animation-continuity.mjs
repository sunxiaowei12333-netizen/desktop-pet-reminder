/** Full-cycle quality gate: FPS alone must never mark an animation fixed. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const run = spawnSync(process.execPath, ['scripts/verify-pet-renderer.cjs'], { encoding: 'utf8', env: process.env, maxBuffer: 16 * 1024 * 1024 });
if (run.status !== 0) {
  process.stderr.write(run.stderr || run.stdout || 'Renderer verification failed\n');
  process.exit(run.status || 1);
}
const directory = /^Report directory: (.+)$/m.exec(run.stdout)?.[1];
if (!directory) throw new Error('Renderer verification did not return its report');
const report = JSON.parse(readFileSync(path.join(directory, 'browser-verification.json')));
const failures = [];
for (const row of report.flicker) {
  // The samples straddle t=.5 by only .0002 of one keyframe interval.
  // Physical motion over that time is negligible. A visible change is a source pop.
  if (row.after.meanInteriorJump >= .1 || row.after.flashingPixelsFraction > .001) {
    failures.push(`${row.action}: source-switch pop (mean ${row.after.meanInteriorJump.toFixed(3)}/255; ${(100 * row.after.flashingPixelsFraction).toFixed(2)}% of interior pixels change by >8/255)`);
  }
}
console.log(`Detailed report: ${directory}`);
if (failures.length) {
  console.error('ANIMATION QUALITY: FAIL — do not present this build as visually fixed.');
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log('Automated continuity checks passed. Whole-cycle visual inspection of all six real actions is still required for ghosting, anatomy, and interior alpha holes.');
}
