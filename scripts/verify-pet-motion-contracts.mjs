import { inspectSequenceAssets } from './inspect-pet-sequences.mjs';
import { writeFileSync } from 'node:fs';
const report=await inspectSequenceAssets();
if(process.env.SEQUENCE_REPORT)writeFileSync(process.env.SEQUENCE_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.pass)process.exitCode=1;
