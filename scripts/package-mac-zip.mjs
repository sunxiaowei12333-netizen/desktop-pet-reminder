import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
// electron-builder.json is the source of truth for the displayed macOS name.
const builder = JSON.parse(readFileSync("electron-builder.json", "utf8"));
const productName = builder.productName || pkg.productName;
const zipPath = `release/${productName}-${pkg.version}-mac.zip`;
const builderOutput = "release/package-build";

function findPackagedApp(root) {
  if (!existsSync(root)) return null;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory() && entry.name === `${productName}.app`) return candidate;
    if (entry.isDirectory()) {
      const nested = findPackagedApp(candidate);
      if (nested) return nested;
    }
  }
  return null;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

await run("npm", ["run", "build"]);
rmSync(builderOutput, { recursive: true, force: true });
await run("npx", [
  "electron-builder",
  "--mac",
  "dir",
  "--config",
  "electron-builder.json",
  `--config.directories.output=${builderOutput}`,
]);
const appPath = findPackagedApp(builderOutput);
if (!appPath) throw new Error(`未在 ${builderOutput} 中找到 ${productName}.app`);
// Framework links are part of the macOS bundle format. Preserve them in the
// archive and validate the final signature before distributing the ZIP.
await run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
await run("codesign", ["--verify", "--deep", "--strict", appPath]);
rmSync(zipPath, { force: true });
await run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath]);

console.log(`Packaged ${zipPath}`);
