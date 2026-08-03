const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:4173";

let tray = null;
let settingsWindow = null;
let petWindow = null;
let lastReminder = null;
let snoozeTimer = null;
let reminderTimer = null;
let generationBootstrapState = {
  state: "idle",
  message: "正在检查本地生成服务",
};
let generationBootstrapPromise = null;
let generationProcess = null;

const defaultSettings = {
  restEnabled: true,
  start: "09:00",
  end: "18:00",
  reminderInterval: "45",
  restWork: "50",
  restDuration: "10",
  reminderBody: "离开屏幕 10 分钟，让眼睛和肩颈松一松。",
};

function settingsFilePath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function assetsFilePath() {
  return path.join(app.getPath("userData"), "pet-assets.json");
}

function readSettings() {
  try {
    const raw = fs.readFileSync(settingsFilePath(), "utf8");
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

function writeSettings(settings) {
  const safeSettings = { ...defaultSettings, ...(settings || {}) };
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(settingsFilePath(), JSON.stringify(safeSettings, null, 2), "utf8");
  scheduleReminder(safeSettings);
  return safeSettings;
}

function readPetAssets() {
  try {
    const raw = fs.readFileSync(assetsFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      photos: Array.isArray(parsed.photos) ? parsed.photos.slice(0, 10) : [],
      profile: parsed.profile || null,
      variants: Array.isArray(parsed.variants) ? parsed.variants : [],
      primarySticker: parsed.primarySticker || null,
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return {
      photos: [],
      profile: null,
      variants: [],
      primarySticker: null,
      updatedAt: null,
    };
  }
}

function writePetAssets(assets) {
  const safeAssets = {
    photos: Array.isArray(assets?.photos) ? assets.photos.slice(0, 10) : [],
    profile: assets?.profile || null,
    variants: Array.isArray(assets?.variants) ? assets.variants : [],
    primarySticker: assets?.primarySticker || null,
    updatedAt: assets?.updatedAt || new Date().toISOString(),
  };

  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(assetsFilePath(), JSON.stringify(safeAssets), "utf8");
  return safeAssets;
}

function buildPetGenerationPlan(referenceCount) {
  return {
    provider: process.env.PET_GENERATION_PROVIDER || "local-comfyui",
    modelFamily: process.env.PET_GENERATION_MODEL_FAMILY || "FLUX / SDXL reference-image workflow",
    referenceCount,
    outputContract: {
      views: 5,
      actions: 6,
      format: "transparent PNG data URL or file URL",
    },
    stages: [
      {
        id: "identity-five-view",
        output: "five transparent-background views of the same real pet cat",
        prompt:
          "Use all uploaded reference photos to infer one consistent real cat identity. Generate five transparent-background views: front, left side, right side, calm resting pose, dynamic/stretch pose. Preserve fur color, facial markings, eye color, body proportion, tail shape, and distinctive details. Do not merely cut out or warp the uploaded photos.",
      },
      {
        id: "action-set",
        output: "six transparent-background desktop pet action sprites",
        prompt:
          "Based on the generated five-view identity sheet, generate six transparent-background realistic cat actions for a desktop reminder pet: waving attention, lying down, side glance, stretching, calm companion, blinking prompt. Keep the same cat identity across all actions.",
      },
    ],
  };
}

function getGenerationConfig() {
  return {
    customEndpoint: process.env.PET_GENERATION_ENDPOINT_URL || "",
    customToken: process.env.PET_GENERATION_ENDPOINT_TOKEN || "",
    comfyBaseUrl: (process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188").replace(/\/$/, ""),
    workflowPath: process.env.COMFYUI_WORKFLOW_PATH || "",
    comfyExecutable: process.env.COMFYUI_EXECUTABLE || "",
    comfyHome: process.env.COMFYUI_HOME || "",
  };
}

async function readGenerationHealth(baseUrl) {
  try {
    const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/system_stats`, {}, 2000);
    return response.ok;
  } catch {
    return false;
  }
}

function resolveComfyUiCandidates() {
  const home = app.getPath("home");
  const candidates = [];

  const envExecutable = process.env.COMFYUI_EXECUTABLE;
  if (envExecutable) candidates.push({ command: envExecutable, args: [], cwd: path.dirname(envExecutable) });

  const envHome = process.env.COMFYUI_HOME;
  if (envHome) candidates.push({ command: process.env.PYTHON || "python3", args: ["main.py"], cwd: envHome });

  candidates.push(
    { command: process.env.PYTHON || "python3", args: ["main.py"], cwd: path.join(home, "ComfyUI") },
    { command: process.env.PYTHON || "python3", args: ["main.py"], cwd: path.join(home, "Desktop", "ComfyUI") },
    { command: process.env.PYTHON || "python3", args: ["main.py"], cwd: "/Applications/ComfyUI" },
  );

  return candidates;
}

function canStartCandidate(candidate) {
  if (!candidate?.cwd) return false;
  if (candidate.args?.[0] === "main.py") {
    return fs.existsSync(path.join(candidate.cwd, "main.py"));
  }
  return fs.existsSync(candidate.command);
}

function startCandidateProcess(candidate) {
  if (generationProcess && !generationProcess.killed) return true;
  if (!candidate) return false;

  const cwd = candidate.cwd;
  const isPythonScript = candidate.args?.[0] === "main.py";
  const command = isPythonScript ? (process.env.PYTHON || "python3") : candidate.command;
  const args = isPythonScript ? candidate.args : candidate.args || [];

  try {
    generationProcess = spawn(command, args, {
      cwd,
      stdio: "ignore",
      detached: true,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    });
    generationProcess.unref();
    generationBootstrapState = {
      state: "starting",
      message: `正在自动启动本地生成服务：${cwd}`,
    };
    return true;
  } catch (error) {
    generationBootstrapState = {
      state: "error",
      message: `自动启动失败：${error.message}`,
    };
    return false;
  }
}

async function autoBootstrapGenerationService() {
  if (generationBootstrapPromise) return generationBootstrapPromise;

  generationBootstrapPromise = (async () => {
    const config = getGenerationConfig();

    if (config.customEndpoint) {
      const ok = await readGenerationHealth(config.customEndpoint);
      generationBootstrapState = ok
        ? { state: "ready", message: "自定义生成服务已就绪" }
        : { state: "starting", message: "正在等待自定义生成服务启动" };
      return generationBootstrapState;
    }

    const comfyOk = await readGenerationHealth(config.comfyBaseUrl);
    if (comfyOk) {
      generationBootstrapState = { state: "ready", message: "本地 ComfyUI 已就绪" };
      return generationBootstrapState;
    }

    const candidate = resolveComfyUiCandidates().find(canStartCandidate);
    if (candidate) {
      startCandidateProcess(candidate);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (await readGenerationHealth(config.comfyBaseUrl)) {
          generationBootstrapState = { state: "ready", message: "本地 ComfyUI 已自动启动" };
          return generationBootstrapState;
        }
      }
      generationBootstrapState = {
        state: "starting",
        message: "已自动拉起本地生成服务，但还在等待它准备完成",
      };
      return generationBootstrapState;
    }

    generationBootstrapState = {
      state: "missing",
      message: "未找到本地生成引擎。程序会继续运行，但首次生成需要安装 ComfyUI 或配置本地生成端点。",
    };
    return generationBootstrapState;
  })();

  return generationBootstrapPromise;
}

function normalizeGeneratedAssets(result, photos) {
  const views = Array.isArray(result?.views) ? result.views.slice(0, 5) : [];
  const variants = Array.isArray(result?.variants) ? result.variants.slice(0, 6) : [];
  return {
    ok: true,
    provider: result?.provider || process.env.PET_GENERATION_PROVIDER || "local-comfyui",
    profile: {
      references: photos.length,
      generator: result?.providerLabel || result?.provider || "本地免费模型",
      ...(result?.profile || {}),
    },
    views,
    variants,
    primarySticker: result?.primarySticker || views[0]?.src || variants[0]?.src || null,
    plan: buildPetGenerationPlan(photos.length),
  };
}

async function postJson(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function generatePetAssetsWithLocalEngine(payload) {
  const photos = Array.isArray(payload?.photos) ? payload.photos.slice(0, 10) : [];
  const plan = buildPetGenerationPlan(photos.length);
  const config = getGenerationConfig();
  await autoBootstrapGenerationService();

  if (config.customEndpoint) {
    try {
      const result = await postJson(
        config.customEndpoint,
        {
          photos,
          plan,
        },
        config.customToken
          ? { Authorization: `Bearer ${config.customToken}` }
          : {},
      );
      return normalizeGeneratedAssets(result, photos);
    } catch (error) {
      return {
        ok: false,
        code: "CUSTOM_GENERATION_ENDPOINT_ERROR",
        message: `本地/自定义生成服务调用失败：${error.message}`,
        plan,
      };
    }
  }

  const comfyBaseUrl = config.comfyBaseUrl;
  const workflowPath = config.workflowPath;

  try {
    await fetchWithTimeout(`${comfyBaseUrl.replace(/\/$/, "")}/system_stats`);
  } catch {
      return {
        ok: false,
        code: "COMFYUI_NOT_RUNNING",
        message: `${generationBootstrapState.message}。当前默认地址：${comfyBaseUrl}`,
        plan,
      };
  }

  return {
    ok: false,
    code: "COMFYUI_WORKFLOW_REQUIRED",
    message: workflowPath
      ? `已连接 ComfyUI，但当前还没有执行工作流适配器：${workflowPath}。请按 docs/local-generation-engine.md 的输出协议接入工作流。`
      : "已连接 ComfyUI。下一步需要配置 COMFYUI_WORKFLOW_PATH 或 PET_GENERATION_ENDPOINT_URL，让工作流输出 5 个五视图和 6 个动作。",
    plan,
  };
}

function minutesFromTime(value) {
  const [hour = "0", minute = "0"] = String(value || "00:00").split(":");
  return Number(hour) * 60 + Number(minute);
}

function currentMinuteOfDay() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isInsideReminderWindow(settings) {
  const now = currentMinuteOfDay();
  const start = minutesFromTime(settings.start);
  const end = minutesFromTime(settings.end);
  if (start === end) return true;
  if (start < end) return now >= start && now <= end;
  return now >= start || now <= end;
}

function msUntilNextStart(settings) {
  const now = new Date();
  const start = minutesFromTime(settings.start);
  const target = new Date(now);
  target.setHours(Math.floor(start / 60), start % 60, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.max(60_000, target.getTime() - now.getTime());
}

function scheduleReminder(settings = readSettings()) {
  clearTimeout(reminderTimer);
  if (!settings.restEnabled) return;

  const intervalMs = Math.max(1, Number(settings.reminderInterval || 45)) * 60 * 1000;
  const delay = isInsideReminderWindow(settings) ? intervalMs : msUntilNextStart(settings);

  reminderTimer = setTimeout(() => {
    const freshSettings = readSettings();
    if (freshSettings.restEnabled && isInsideReminderWindow(freshSettings)) {
      showPet({ body: freshSettings.reminderBody });
    }
    scheduleReminder(freshSettings);
  }, delay);
}

function loadRenderer(window, surface) {
  const query = `surface=${encodeURIComponent(surface)}`;
  if (isDev) {
    window.loadURL(`${devServerUrl}?${query}`);
    return;
  }
  window.loadFile(path.join(__dirname, "../dist/index.html"), { query: { surface } });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 456,
    height: 720,
    minWidth: 380,
    minHeight: 560,
    show: false,
    title: "休息时刻",
    titleBarStyle: "hiddenInset",
    vibrancy: "under-window",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });

  settingsWindow.once("ready-to-show", () => settingsWindow.show());
  loadRenderer(settingsWindow, "settings");
  return settingsWindow;
}

function createPetWindow() {
  if (petWindow && !petWindow.isDestroyed()) {
    return petWindow;
  }

  petWindow = new BrowserWindow({
    width: 520,
    height: 270,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  petWindow.setAlwaysOnTop(true, "screen-saver");
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.setIgnoreMouseEvents(false);

  petWindow.on("closed", () => {
    petWindow = null;
  });

  loadRenderer(petWindow, "pet");
  return petWindow;
}

function positionPetWindow() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const bounds = petWindow.getBounds();
  petWindow.setBounds({
    x: Math.round(area.x + area.width - bounds.width - 18),
    y: Math.round(area.y + 18),
    width: bounds.width,
    height: bounds.height,
  });
}

function showPet(reminder) {
  lastReminder = reminder || lastReminder || {
    body: readSettings().reminderBody,
  };

  const window = createPetWindow();
  positionPetWindow();
  window.showInactive();
  window.webContents.send("pet:reminder", lastReminder);
}

function hidePet() {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.hide();
  }
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    "data:image/svg+xml;utf8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
          <path fill="black" d="M5.5 6.5c.2-2.1 1.2-3.8 2.7-4.7.5-.3 1.1.1 1.2.7l.4 2.2c.8-.2 1.6-.2 2.4 0l.4-2.2c.1-.6.8-1 1.3-.7 1.5.9 2.4 2.6 2.6 4.7 1 1 1.6 2.4 1.6 4 0 4.1-3.2 7.3-7.1 7.3s-7.1-3.2-7.1-7.3c0-1.6.6-3 1.6-4Zm5.5 9.1c2.7 0 4.9-2.2 4.9-5.1 0-2.7-2.1-4.4-4.9-4.4S6.1 7.8 6.1 10.5c0 2.9 2.2 5.1 4.9 5.1Z"/>
        </svg>
      `),
  );
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip("休息时刻");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开设置", click: () => createSettingsWindow() },
      { label: "测试提醒", click: () => showPet({ body: readSettings().reminderBody }) },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => createSettingsWindow());
}

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock.hide();
  }
  createTray();
  createPetWindow();
  scheduleReminder(readSettings());
  autoBootstrapGenerationService();
  screen.on("display-metrics-changed", positionPetWindow);
});

app.on("window-all-closed", () => {});

app.on("activate", () => {
  createSettingsWindow();
});

ipcMain.handle("settings:get", () => readSettings());
ipcMain.handle("settings:save", (_event, settings) => writeSettings(settings));
ipcMain.handle("assets:get", () => readPetAssets());
ipcMain.handle("assets:save", (_event, assets) => writePetAssets(assets));
ipcMain.handle("generation:status", () => generationBootstrapState);
ipcMain.handle("generation:ensure", async () => autoBootstrapGenerationService());
ipcMain.handle("generation:generate-pet-assets", (_event, payload) => generatePetAssetsWithLocalEngine(payload));

ipcMain.on("pet:show", (_event, reminder) => showPet(reminder));
ipcMain.on("pet:dismiss", () => {
  clearTimeout(snoozeTimer);
  hidePet();
});
ipcMain.on("pet:snooze", (_event, minutes = 15) => {
  clearTimeout(snoozeTimer);
  clearTimeout(reminderTimer);
  hidePet();
  snoozeTimer = setTimeout(() => {
    showPet(lastReminder);
    scheduleReminder(readSettings());
  }, Number(minutes) * 60 * 1000);
});
