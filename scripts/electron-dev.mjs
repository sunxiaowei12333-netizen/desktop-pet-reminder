import { spawn } from "node:child_process";

const cwd = process.cwd();
const env = {
  ...process.env,
  VITE_DEV_SERVER_URL: "http://127.0.0.1:4173",
};

const vite = spawn("npm", ["run", "dev"], {
  cwd,
  env,
  stdio: "inherit",
});

let electronStarted = false;

function startElectron() {
  if (electronStarted) return;
  electronStarted = true;
  const electron = spawn("npx", ["electron", "."], {
    cwd,
    env,
    stdio: "inherit",
  });

  electron.on("exit", (code) => {
    vite.kill();
    process.exit(code ?? 0);
  });
}

const timer = setInterval(async () => {
  try {
    const response = await fetch(env.VITE_DEV_SERVER_URL);
    if (response.ok) {
      clearInterval(timer);
      startElectron();
    }
  } catch {
    // Vite is still starting.
  }
}, 350);

vite.on("exit", (code) => {
  if (!electronStarted) process.exit(code ?? 0);
});
