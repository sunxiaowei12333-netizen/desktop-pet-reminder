import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const appPath = `release/mac/${pkg.productName}.app`;
const zipPath = `release/${pkg.productName}-${pkg.version}-mac.zip`;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

await run("npm", ["run", "build"]);
await run("npx", ["electron-builder", "--mac", "dir", "--config", "electron-builder.json"]);
await run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath]);

console.log(`Packaged ${zipPath}`);
