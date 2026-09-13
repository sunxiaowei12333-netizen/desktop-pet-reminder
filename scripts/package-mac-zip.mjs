import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
// electron-builder.json is the source of truth for the displayed macOS name.
const builder = JSON.parse(readFileSync("electron-builder.json", "utf8"));
const productName = builder.productName || pkg.productName;
const appPath = `release/mac/${productName}.app`;
const zipPath = `release/${productName}-${pkg.version}-mac.zip`;
const flatRoot = "release/mac-flat";
const flatAppPath = `${flatRoot}/${productName}.app`;

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
await run("npx", ["electron-builder", "--mac", "dir", "--config", "electron-builder.json"]);
// Finder/Archive Utility can materialize framework symlinks as empty folders
// when extracting a ZIP. Dereference them before archiving so the downloaded
// app remains self-contained and can always find libffmpeg.dylib.
rmSync(flatRoot, { recursive: true, force: true });
mkdirSync(flatRoot, { recursive: true });
await run("rsync", ["-aL", `${appPath}/`, `${flatAppPath}/`]);
rmSync(zipPath, { force: true });
await run("zip", ["-qry", `../${productName}-${pkg.version}-mac.zip`, `${productName}.app`], { cwd: flatRoot });

console.log(`Packaged ${zipPath}`);
