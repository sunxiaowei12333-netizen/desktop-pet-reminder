const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, powerMonitor } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const { createReminderRuntime, intervalMinutes } = require("./reminder-runtime.cjs");

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:4173";

let tray = null;
let settingsWindow = null;
let petWindow = null;
let reminderWindow = null;
let petWindowPositioned = false;
let reminderVisible = false;
let syncingReminderWindows = false;
const readyReminderWindows = new WeakSet();
const expectedReminderBounds = new WeakMap();
const REMINDER_SCALE = 0.9;
const reminderPixels = value => Math.round(value * REMINDER_SCALE);
const PET_SCALE = 0.83;
const PET_SIZE = { width: Math.round(220 * PET_SCALE), height: Math.round(240 * PET_SCALE) };
const REMINDER_WIDTH = reminderPixels(260);
const REMINDER_GAP = reminderPixels(14);
let lastReminder = null;
let reminderRuntime = null;
let generationBootstrapState = {
  state: "idle",
  message: "正在检查本地生成服务",
};
let generationBootstrapPromise = null;
let generationProcess = null;

function quitApp() {
  // Mark this before destroying windows: the settings window's close handler
  // otherwise turns a normal quit into another hide-to-tray operation.
  app.isQuitting = true;
  reminderRuntime?.stop();
  if (generationProcess && !generationProcess.killed) generationProcess.kill("SIGTERM");
  generationProcess = null;
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.destroy();
  if (petWindow && !petWindow.isDestroyed()) petWindow.destroy();
  if (reminderWindow && !reminderWindow.isDestroyed()) reminderWindow.destroy();
  if (tray) {
    tray.destroy();
    tray = null;
  }
  // app.quit() runs Electron's normal shutdown path and is more reliable
  // than only calling app.exit() when a tray menu owns the last UI surface.
  app.quit();
}

const defaultSettings = {
  restEnabled: true,
  start: "09:00",
  end: "18:00",
  reminderInterval: "45",
  reminderIntervalMinutes: 45,
  restWork: "50",
  restDuration: "10",
  reminderBody: "离开屏幕 10 分钟，让眼睛和肩颈松一松。",
  generationEndpointUrl: "",
  generationEndpointToken: "",
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
    const saved = JSON.parse(raw);
    const parsed = { ...defaultSettings, ...saved, reminderIntervalMinutes: intervalMinutes(saved), reminderInterval: String(intervalMinutes(saved)) };
    if (parsed.generationEndpointUrl === "http://127.0.0.1:8787/generate") {
      parsed.generationEndpointUrl = "";
    }
    return parsed;
  } catch {
    return defaultSettings;
  }
}

function writeSettings(settings) {
  const minutes = intervalMinutes(settings || {});
  const safeSettings = { ...defaultSettings, ...(settings || {}), reminderIntervalMinutes: minutes, reminderInterval: String(minutes) };
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(settingsFilePath(), JSON.stringify(safeSettings, null, 2), "utf8");
  scheduleReminder(safeSettings);
  if (!safeSettings.restEnabled) hidePet();
  return safeSettings;
}

function readPetAssets() {
  try {
    const raw = fs.readFileSync(assetsFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      photos: Array.isArray(parsed.photos) ? parsed.photos.slice(0, 10) : [],
      pipelineVersion: Number(parsed.pipelineVersion || 0),
      imageModel: parsed.imageModel || null,
      profile: parsed.profile || null,
      variants: Array.isArray(parsed.variants) ? parsed.variants : [],
      primarySticker: parsed.primarySticker || null,
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return {
      photos: [],
      pipelineVersion: 0,
      imageModel: null,
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
    pipelineVersion: Number(assets?.pipelineVersion || 0),
    imageModel: assets?.imageModel || null,
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
    provider: process.env.PET_GENERATION_PROVIDER || "gpt-image-2",
    modelFamily: process.env.PET_GENERATION_MODEL_FAMILY || "图像生成服务",
    referenceCount,
    outputContract: {
      views: 5,
      actions: 6,
      format: "transparent PNG data URL or file URL",
    },
    stages: [
      {
        id: "gpt-image-2-identity-views",
        type: "image-edit",
        input: "all-reference-photos",
        output: "five new transparent-background views of the same real cat",
        prompt:
          "Use all uploaded photos as identity references for the same real cat. Generate five new transparent-background images: front, left side, right side, calm resting pose, and dynamic pose. Preserve the cat's exact fur colors, markings, face shape, eyes, ears, body proportions, and tail. Gently clean visible eye discharge/crust from both eye corners while preserving natural eyes, eyelids and fur detail; no beauty-filter smoothing. This is image-to-image generation: never return an uploaded photo, crop it, mirror it, rotate it, or warp it.",
      },
      {
        id: "gpt-image-2-action-set",
        type: "image-edit",
        input: "generated-five-view-renders",
        output: "six transparent-background desktop pet action sprites",
        prompt:
          "Use the generated five-view identity images as references and create six new, visibly different transparent-background realistic cat actions: waving attention, lying down, side glance, stretching, calm companion, and blinking prompt. Keep the same cat identity, markings, proportions, and fur across every action. Gently clean visible eye discharge/crust from both eye corners while preserving natural eyes, eyelids and fur detail; no beauty-filter smoothing. Do not return or directly edit any uploaded source photo. Do not add a cup or other prop.",
      },
    ],
    constraints: [
      "must-return-five-new-views",
      "must-return-six-new-actions",
      "no-source-photo-as-final-output",
      "transparent-png-output",
    ],
  };
}

function getGenerationConfig(settings = readSettings()) {
  return {
    customEndpoint: settings.generationEndpointUrl || process.env.PET_GENERATION_ENDPOINT_URL || "",
    customToken: settings.generationEndpointToken || process.env.PET_GENERATION_ENDPOINT_TOKEN || "",
    comfyBaseUrl: (process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188").replace(/\/$/, ""),
    workflowPath: process.env.COMFYUI_WORKFLOW_PATH || "",
    comfyExecutable: process.env.COMFYUI_EXECUTABLE || "",
    comfyHome: process.env.COMFYUI_HOME || "",
  };
}

async function generateWithBundledImage2(photos, apiKey) {
  const providerPath = path.join(app.getAppPath(), "scripts", "image2-provider.mjs");
  const { generatePetAssetsWithImage2 } = await import(pathToFileURL(providerPath).href);
  return generatePetAssetsWithImage2({
    photos,
    apiKey: apiKey || process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
  });
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
    pipelineVersion: 2,
    imageModel: result?.imageModel || result?.provider || "image2",
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
  const config = {
    ...getGenerationConfig(),
    customEndpoint: payload?.generationSettings?.customEndpoint || getGenerationConfig().customEndpoint,
    customToken: payload?.generationSettings?.customToken || getGenerationConfig().customToken,
  };

  // For this personal build, a token means the user explicitly enabled the
  // bundled ImageGen path. Do not route uploads through the old local engine.
  if (!config.customEndpoint && config.customToken) {
    try {
      const result = await generateWithBundledImage2(photos, config.customToken);
      return normalizeGeneratedAssets(result, photos);
    } catch (error) {
      return {
        ok: false,
        code: "IMAGE2_SERVICE_ERROR",
        message: `图像生成服务调用失败：${error.message}`,
        plan,
      };
    }
  }

  if (!config.customEndpoint) {
    return {
      ok: false,
      code: "IMAGE2_API_KEY_REQUIRED",
      message: "请在提醒形象里填写 OpenAI API Key，再生成参考视图和 6 个动作。",
      plan,
    };
  }

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

const reminderActions = [
  ["wave", "挥手提醒", "nailao-action-wave-image2.gif"],
  ["rest", "趴下休息", "nailao-action-rest-image2.gif"],
  ["look", "侧身看看", "nailao-action-look-image2.gif"],
  ["stretch", "伸懒腰", "nailao-action-stretch-image2.gif"],
  ["companion", "安静陪伴", "nailao-action-companion-image2.gif"],
  ["blink", "眨眼提示", "nailao-action-blink-image2.gif"],
];

function getReminderRuntime() {
  if (reminderRuntime) return reminderRuntime;
  const stateFile = path.join(app.getPath("userData"), "reminder-runtime.json");
  const actionFiles = isDev ? null : JSON.parse(fs.readFileSync(path.join(__dirname, "../dist/pet-actions.json"), "utf8"));
  reminderRuntime = createReminderRuntime({
    now: () => Date.now(), setTimer: setTimeout, clearTimer: clearTimeout,
    actions: reminderActions.map(([id, label, file]) => ({
      id, label, src: isDev
        ? new URL(`/src/assets/nailao/${file}`, devServerUrl).href
        : pathToFileURL(path.join(__dirname, "../dist", actionFiles[id])).href,
    })),
    loadState: () => JSON.parse(fs.readFileSync(stateFile, "utf8")),
    saveState(state) {
      try {
        fs.mkdirSync(app.getPath("userData"), { recursive: true });
        const temporary = stateFile + ".tmp";
        fs.writeFileSync(temporary, JSON.stringify(state, null, 2), "utf8");
        fs.renameSync(temporary, stateFile);
      } catch (error) { console.warn("Could not save reminder timing history:", error.message); }
    },
    onReminder: displayPet,
    onStatus(status) {
      if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send("reminder:status", status);
    },
  });
  return reminderRuntime;
}

function scheduleReminder(settings = readSettings()) {
  return getReminderRuntime().update(settings);
}

function showPet(reminder) {
  return getReminderRuntime().show("test", reminder || { body: readSettings().reminderBody });
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
    // Keep the native traffic lights in their own title bar; hiddenInset put
    // them on top of the app's coffee icon.
    titleBarStyle: "default",
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

function pairWindowOptions(surface) {
  return {
    width: surface === "pet" ? PET_SIZE.width : REMINDER_WIDTH,
    height: surface === "pet" ? PET_SIZE.height : reminderPixels(150),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    show: false,
    backgroundColor: "#00000000",
    // The CSS card owns the only rounded background. A second native vibrancy
    // surface has a different corner mask and leaks into the transparent corners.
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      ...(surface === "pet" ? { backgroundThrottling: false, imageAnimationPolicy: "animate" } : {}),
    },
  };
}

function liveReminderWindows() {
  return [petWindow, reminderWindow].filter(window => window && !window.isDestroyed());
}

function configureReminderWindow(window, surface) {
  window.setAlwaysOnTop(true, "screen-saver");
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.setFocusable(false);
  window.setIgnoreMouseEvents(false);
  window.on("move", () => syncReminderWindows(window));
  window.webContents.on("did-start-loading", () => {
    readyReminderWindows.delete(window);
    // Keep a reloading surface from exposing a blank card or stale animation.
    for (const sibling of liveReminderWindows()) sibling.hide();
  });
  window.on("closed", () => {
    if (surface === "pet") petWindow = null;
    else reminderWindow = null;
    petWindowPositioned = false;
    hidePet();
  });
  loadRenderer(window, surface);
}

function createPetWindow() {
  // Put the actionable reminder first in the native accessibility window list.
  if (!reminderWindow || reminderWindow.isDestroyed()) {
    reminderWindow = new BrowserWindow(pairWindowOptions("reminder"));
    configureReminderWindow(reminderWindow, "reminder");
  }
  if (!petWindow || petWindow.isDestroyed()) {
    petWindow = new BrowserWindow(pairWindowOptions("pet"));
    configureReminderWindow(petWindow, "pet");
  }
  return petWindow;
}

function matchingWorkArea(bounds) {
  return screen.getDisplayMatching(bounds).workArea;
}

function setPairBounds(window, bounds) {
  const current = window.getBounds();
  expectedReminderBounds.set(window, bounds);
  if (Object.keys(bounds).some(key => bounds[key] !== current[key])) window.setBounds(bounds);
}

function positionReminderPair(petX, petY, area) {
  if (!petWindow || !reminderWindow) return;
  const card = reminderWindow.getBounds();
  const maxHeight = Math.max(1, Math.min(reminderPixels(480), area.height - reminderPixels(16)));
  const height = Math.min(card.height, maxHeight);
  const totalWidth = REMINDER_WIDTH + REMINDER_GAP + PET_SIZE.width;
  const totalHeight = Math.max(PET_SIZE.height, height);
  const petOffset = Math.round((totalHeight - PET_SIZE.height) / 2);
  const cardOffset = Math.round((totalHeight - height) / 2);
  // Clamp the entire pair, including a growing card, to the selected display.
  const left = Math.round(Math.max(area.x, Math.min(
    petX - REMINDER_WIDTH - REMINDER_GAP,
    area.x + Math.max(0, area.width - totalWidth),
  )));
  const top = Math.round(Math.max(area.y, Math.min(
    petY - petOffset,
    area.y + Math.max(0, area.height - totalHeight),
  )));
  syncingReminderWindows = true;
  try {
    setPairBounds(petWindow, { x: left + REMINDER_WIDTH + REMINDER_GAP, y: top + petOffset, ...PET_SIZE });
    setPairBounds(reminderWindow, { x: left, y: top + cardOffset, width: REMINDER_WIDTH, height });
  } finally {
    syncingReminderWindows = false;
  }
}

function syncReminderWindows(source) {
  if (syncingReminderWindows || !petWindow || !reminderWindow || source.isDestroyed()) return;
  const bounds = source.getBounds();
  const expected = expectedReminderBounds.get(source);
  // Native move events can arrive after setBounds returns. Ignore acknowledgments.
  if (expected && Object.keys(expected).every(key => expected[key] === bounds[key])) return;
  petWindowPositioned = true;
  const petX = source === petWindow ? bounds.x : bounds.x + REMINDER_WIDTH + REMINDER_GAP;
  const petY = bounds.y + bounds.height / 2 - PET_SIZE.height / 2;
  positionReminderPair(petX, petY, matchingWorkArea(bounds));
}

function positionPetWindow() {
  if (!petWindow || !reminderWindow) return;
  if (petWindowPositioned) {
    const bounds = petWindow.getBounds();
    positionReminderPair(bounds.x, bounds.y, matchingWorkArea(bounds));
    return;
  }
  const area = screen.getPrimaryDisplay().workArea;
  positionReminderPair(area.x + area.width - PET_SIZE.width - reminderPixels(18), area.y + reminderPixels(18), area);
}

function presentReminderWindows() {
  const windows = liveReminderWindows();
  if (!reminderVisible || windows.length !== 2 || !windows.every(window => readyReminderWindows.has(window))) return;
  positionPetWindow();
  for (const window of windows) window.showInactive();
}

function displayPet(reminder) {
  lastReminder = reminder || lastReminder || { body: readSettings().reminderBody };
  reminderVisible = true;
  createPetWindow();
  positionPetWindow();
  for (const window of liveReminderWindows()) {
    if (readyReminderWindows.has(window)) window.webContents.send("pet:reminder", lastReminder);
  }
  presentReminderWindows();
}

function hidePet() {
  reminderVisible = false;
  for (const window of liveReminderWindows()) {
    window.hide();
    if (readyReminderWindows.has(window)) window.webContents.send("pet:reminder", null);
  }
}

function markReminderReady(event) {
  const window = liveReminderWindows().find(candidate => candidate.webContents === event.sender);
  if (!window) return;
  readyReminderWindows.add(window);
  // Readiness acknowledges listeners, not a request to make hidden windows visible.
  window.webContents.send("pet:reminder", reminderVisible ? lastReminder : null);
  presentReminderWindows();
}

function resizeReminder(event, requestedHeight) {
  if (!petWindow || petWindow.isDestroyed() || !reminderWindow || reminderWindow.isDestroyed() || event.sender !== reminderWindow.webContents) return;
  if (typeof requestedHeight !== "number" || !Number.isFinite(requestedHeight)) return;
  const petBounds = petWindow.getBounds();
  const area = matchingWorkArea(petBounds);
  const maxHeight = Math.max(1, Math.min(reminderPixels(480), area.height - reminderPixels(16)));
  const height = Math.min(maxHeight, Math.max(reminderPixels(120), Math.ceil(requestedHeight)));
  const card = reminderWindow.getBounds();
  syncingReminderWindows = true;
  try { setPairBounds(reminderWindow, { ...card, height }); }
  finally { syncingReminderWindows = false; }
  positionReminderPair(petBounds.x, petBounds.y, area);
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    "data:image/svg+xml;utf8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
          <path fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M6 4.5h9v7.2A4.3 4.3 0 0 1 10.7 16H10a4 4 0 0 1-4-4V4.5Zm9 2h1.2a2.4 2.4 0 0 1 0 4.8H15M8 19h7M7.5 2.5h6"/>
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
        click: quitApp,
      },
    ]),
  );
  tray.on("click", () => createSettingsWindow());
}

const ownsReminderInstance = app.requestSingleInstanceLock();
if (!ownsReminderInstance) app.quit();
app.on("second-instance", () => createSettingsWindow());

if (ownsReminderInstance) app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock.hide();
  }
  createTray();
  createPetWindow();
  // Make a direct launch visibly open the main settings window instead of
  // starting only as a hidden menu-bar process.
  createSettingsWindow();
  scheduleReminder(readSettings());
  powerMonitor.on("resume", () => getReminderRuntime().wake());
  autoBootstrapGenerationService();
  screen.on("display-metrics-changed", positionPetWindow);
  screen.on("display-removed", positionPetWindow);
});

app.on("before-quit", () => {
  app.isQuitting = true;
  reminderRuntime?.stop();
  if (generationProcess && !generationProcess.killed) generationProcess.kill("SIGTERM");
  generationProcess = null;
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.destroy();
  if (petWindow && !petWindow.isDestroyed()) petWindow.destroy();
  if (reminderWindow && !reminderWindow.isDestroyed()) reminderWindow.destroy();
  if (tray) tray.destroy();
  tray = null;
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

ipcMain.on("pet:ready", markReminderReady);
ipcMain.on("pet:resize-reminder", resizeReminder);
ipcMain.on("pet:show", (_event, reminder) => showPet(reminder));
ipcMain.on("pet:dismiss", () => hidePet());
ipcMain.on("pet:snooze", (_event, minutes = 15) => {
  hidePet();
  getReminderRuntime().snooze(minutes, { body: lastReminder?.body || readSettings().reminderBody });
});
ipcMain.handle("reminder:status", () => getReminderRuntime().status());
ipcMain.handle("reminder:pause", (_event, paused) => {
  const status = getReminderRuntime().setPaused(paused);
  if (paused) hidePet();
  return status;
});
