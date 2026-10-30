// Compatibility entry point. The production renderer now uses one fixed texture.
import { spawnSync } from 'node:child_process';
const run=spawnSync(process.execPath,['scripts/verify-pet-rig.cjs'],{stdio:'inherit',env:process.env});
process.exitCode=run.status ?? 1;
