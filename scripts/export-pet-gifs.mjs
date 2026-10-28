import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const output = path.resolve(process.argv[2] || "release/pet-gifs");
mkdirSync(output, { recursive: true });
const actions = [
  ["wave", "01-挥手提醒"], ["rest", "02-趴下休息"], ["look", "03-侧身看看"],
  ["stretch", "04-伸懒腰"], ["companion", "05-安静陪伴"], ["blink", "06-眨眼提示"],
];
for (const [id, label] of actions) {
  copyFileSync(`src/assets/nailao/nailao-action-${id}-image2.gif`, path.join(output, `${label}.gif`));
}
console.log(`Exported all six transparent GIFs to ${output}`);
