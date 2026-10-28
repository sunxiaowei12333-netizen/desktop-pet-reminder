const assert = require("node:assert/strict");
const { test } = require("node:test");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const electronDir = path.join(__dirname, "../electron");

function harness() {
  const windows = [];
  const timers = new Map();
  const nativeMoveEvents = [];
  let timerId = 0;
  let area = { x: 0, y: 25, width: 1440, height: 875 };
  const settings = { restEnabled: true, start: "00:00", end: "00:00", reminderIntervalMinutes: 45, reminderBody: "离开屏幕休息一下。" };
  class MockWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.bounds = { x: 0, y: 0, width: options.width, height: options.height };
      this.visible = false;
      this.destroyed = false;
      this.messages = [];
      this.webContents = new EventEmitter();
      this.webContents.send = (channel, data) => this.messages.push({ channel, data });
      windows.push(this);
    }
    getBounds() { return { ...this.bounds }; }
    setBounds(bounds) {
      this.bounds = { ...bounds };
      this.emit("move");
      nativeMoveEvents.push(() => this.emit("move"));
    }
    drag(x, y) { this.bounds.x = x; this.bounds.y = y; this.emit("move"); }
    loadFile(_file, { query }) { this.surface = query.surface; this.webContents.emit("did-start-loading"); }
    loadURL(url) { this.surface = new URL(url).searchParams.get("surface"); this.webContents.emit("did-start-loading"); }
    isDestroyed() { return this.destroyed; }
    showInactive() { this.visible = true; this.showCount = (this.showCount || 0) + 1; }
    show() { this.visible = true; }
    focus() { this.focusCount = (this.focusCount || 0) + 1; }
    hide() { this.visible = false; }
    destroy() { this.destroyed = true; this.visible = false; this.emit("closed"); }
    setAlwaysOnTop(value, level) { this.top = { value, level }; }
    setVisibleOnAllWorkspaces(value, options) { this.workspaces = { value, options }; }
    setFocusable(value) { this.focusable = value; }
    setIgnoreMouseEvents(value) { this.ignoreMouse = value; }
  }
  const ipcMain = new EventEmitter();
  ipcMain.handle = () => {};
  const app = new EventEmitter();
  app.isPackaged = true;
  app.requestSingleInstanceLock = () => true;
  app.whenReady = () => ({ then: callback => { app.start = callback; } });
  app.getPath = () => "/mock-user-data";
  app.quit = () => { app.quitCalled = true; app.emit("before-quit"); };
  app.dock = { hide() {} };
  const screen = new EventEmitter();
  screen.getPrimaryDisplay = screen.getDisplayMatching = () => ({ workArea: { ...area } });
  const electron = { app, BrowserWindow: MockWindow, ipcMain, screen, nativeImage: {}, Tray: class {}, Menu: {} };
  const context = vm.createContext({
    require(name) {
      if (name === "electron") return electron;
      if (name === "fs") return {
        readFileSync(file) {
          if (file.endsWith("pet-actions.json")) return JSON.stringify(Object.fromEntries(["wave","rest","look","stretch","companion","blink"].map(id => [id, `assets/${id}.gif`])));
          assert.ok(file.endsWith("settings.json")); return JSON.stringify(settings);
        },
        mkdirSync() {}, writeFileSync() {}, renameSync() {}, existsSync() { return false; },
      };
      if (name === "child_process") return { spawn() { throw new Error("Unexpected generation process"); } };
      return require(name.startsWith("./") ? path.join(electronDir, name) : name);
    },
    __dirname: electronDir,
    process: { platform: "darwin", env: {} },
    URL, console,
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext(fs.readFileSync(path.join(electronDir, "main.cjs"), "utf8"), context);
  const api = vm.runInContext("({ createPetWindow, showPet, hidePet, positionPetWindow, scheduleReminder, quitApp })", context);
  const pair = () => ({ pet: windows.find(w => w.surface === "pet" && !w.destroyed), card: windows.find(w => w.surface === "reminder" && !w.destroyed) });
  const ready = window => ipcMain.emit("pet:ready", { sender: window.webContents });
  const flushMoves = () => {
    let count = 0;
    while (nativeMoveEvents.length) { assert.ok(++count < 100, "native move feedback loop"); nativeMoveEvents.shift()(); }
  };
  const send = (channel, window, ...args) => ipcMain.emit(channel, { sender: window.webContents }, ...args);
  return { api, windows, pair, ready, flushMoves, send, ipcMain, app, timers, settings, area: () => area, setArea(value) { area = value; } };
}

test("native card is separate from the transparent unthrottled cat and both preserve isolation", () => {
  const h = harness(); h.api.createPetWindow(); const { pet, card } = h.pair();
  assert.equal(pet.options.width, 198); assert.equal(pet.options.height, 216);
  assert.equal(card.options.width, 234); assert.equal(card.options.height, 135);
  assert.equal(pet.options.vibrancy, undefined);
  assert.equal(card.options.vibrancy, undefined); assert.equal(card.options.roundedCorners, false);
  assert.equal(pet.options.webPreferences.backgroundThrottling, false);
  assert.equal(pet.options.webPreferences.imageAnimationPolicy, "animate");
  for (const window of [pet, card]) {
    assert.equal(window.options.transparent, true); assert.equal(window.options.backgroundColor, "#00000000");
    assert.equal(window.options.webPreferences.contextIsolation, true); assert.equal(window.options.webPreferences.nodeIntegration, false);
    assert.equal(window.focusable, false); assert.equal(window.ignoreMouse, false);
    assert.equal(window.workspaces.value, true); assert.equal(window.workspaces.options.visibleOnFullScreen, true);
    assert.equal(window.top.level, "screen-saver"); assert.equal(window.visible, false);
  }
});

test("a reminder before readiness is delivered to both and shown only once both listeners exist", () => {
  const h = harness(); const reminder = { body: "first", action: { gif: "cat.webp" } };
  h.api.showPet(reminder); const { pet, card } = h.pair();
  assert.equal(pet.visible, false); assert.equal(card.visible, false);
  h.ready(card); assert.equal(card.messages.at(-1).data.body, reminder.body); assert.equal(card.visible, false);
  h.ready(pet); assert.equal(pet.messages.at(-1).data.body, reminder.body);
  assert.equal(pet.visible, true); assert.equal(card.visible, true);
  assert.equal(pet.bounds.x - card.bounds.x - card.bounds.width, 7);
  assert.ok(Math.abs(card.bounds.y + card.bounds.height / 2 - pet.bounds.y - pet.bounds.height / 2) <= .5);
  h.flushMoves();
});

test("dismissal before readiness or during reload cannot resurrect either window", () => {
  const h = harness(); h.api.showPet({ body: "dismiss" }); const { pet, card } = h.pair();
  h.ready(pet); h.send("pet:dismiss", pet); h.ready(card);
  assert.equal(pet.visible, false); assert.equal(card.visible, false); assert.equal(card.messages.at(-1).data, null);
  h.api.showPet({ body: "next" }); assert.equal(card.visible, true);
  card.webContents.emit("did-start-loading"); assert.equal(pet.visible, false); assert.equal(card.visible, false);
  h.send("pet:dismiss", card); h.ready(card);
  assert.equal(card.visible, false); assert.equal(pet.visible, false);
});

test("dragging either surface moves the pair and clamps its combined bounds", () => {
  const h = harness(); h.api.showPet({ body: "move" }); const { pet, card } = h.pair(); h.ready(pet); h.ready(card);
  pet.drag(800, 200); h.flushMoves(); assert.equal(card.bounds.x, 559); assert.ok(Math.abs(card.bounds.y + card.bounds.height / 2 - pet.bounds.y - pet.bounds.height / 2) <= .5);
  card.drag(200, 300); h.flushMoves(); assert.equal(pet.bounds.x, 441); assert.ok(Math.abs(card.bounds.y + card.bounds.height / 2 - pet.bounds.y - pet.bounds.height / 2) <= .5);
  pet.drag(-100, 9999); h.flushMoves(); const area = h.area();
  assert.equal(card.bounds.x, area.x); assert.equal(pet.bounds.y + pet.bounds.height, area.y + area.height);
  card.drag(9999, -100); h.flushMoves();
  assert.equal(pet.bounds.x + pet.bounds.width, area.x + area.width); assert.equal(pet.bounds.y, area.y);
});

test("only the card may resize, heights are bounded, and a growing card stays on screen", () => {
  const h = harness(); h.api.showPet({ body: "resize" }); const { pet, card } = h.pair(); h.ready(pet); h.ready(card);
  const original = card.bounds.height; h.send("pet:resize-reminder", pet, 400); assert.equal(card.bounds.height, original);
  for (const value of [NaN, Infinity, "400", null]) h.send("pet:resize-reminder", card, value);
  assert.equal(card.bounds.height, original);
  pet.drag(900, 650); h.send("pet:resize-reminder", card, 9999); h.flushMoves();
  assert.equal(card.bounds.height, 432); assert.ok(card.bounds.y + card.bounds.height <= h.area().y + h.area().height);
  h.send("pet:resize-reminder", card, -20); assert.equal(card.bounds.height, 108);
  h.setArea({ x: -1024, y: 0, width: 1024, height: 400 }); h.api.positionPetWindow();
  h.send("pet:resize-reminder", card, 500); h.flushMoves();
  assert.equal(card.bounds.height, 386); assert.ok(card.bounds.y >= 0); assert.ok(card.bounds.y + card.bounds.height <= 400);
  assert.ok(card.bounds.x >= -1024); assert.ok(pet.bounds.x + pet.bounds.width <= 0);
  h.api.hidePet(); h.send("pet:resize-reminder", card, 180); assert.equal(card.visible, false);
});

test("ready windows receive each new action, and snooze preserves payload and normal schedule", () => {
  const h = harness(); h.api.createPetWindow(); const { pet, card } = h.pair(); h.ready(pet); h.ready(card);
  const reminder = { body: "snooze", action: { gif: "look.webp" } }; h.api.showPet(reminder);
  h.api.scheduleReminder(h.settings); assert.ok([...h.timers.values()].some(timer => timer.delay > 45 * 60000 - 20 && timer.delay <= 45 * 60000));
  const firstAction = pet.messages.at(-1).data.action.id;
  h.send("pet:snooze", card, 15); assert.equal(pet.visible, false); assert.equal(card.visible, false);
  assert.equal(h.timers.size, 1); const [id, snooze] = [...h.timers.entries()][0]; assert.equal(snooze.delay, 15 * 60000);
  h.timers.delete(id); snooze.callback();
  assert.equal(pet.messages.at(-1).data.body, reminder.body); assert.equal(card.messages.at(-1).data.body, reminder.body);
  assert.equal(pet.visible, true); assert.equal(card.visible, true);
  assert.notEqual(pet.messages.at(-1).data.action.id, firstAction);
  assert.ok([...h.timers.values()].some(timer => timer.delay > 45 * 60000 - 20 && timer.delay <= 45 * 60000));
});

test("normal scheduling uses saved text and disabling reminders cancels its timer", () => {
  const h = harness(); h.api.createPetWindow(); const { pet, card } = h.pair(); h.ready(pet); h.ready(card);
  h.api.scheduleReminder(h.settings); const [id, timer] = [...h.timers.entries()][0];
  h.timers.delete(id); timer.callback();
  assert.equal(pet.messages.at(-1).data.body, h.settings.reminderBody);
  assert.equal(card.messages.at(-1).data.body, h.settings.reminderBody);
  h.api.scheduleReminder({ ...h.settings, restEnabled: false }); assert.equal(h.timers.size, 0);
});

test("quitting destroys both surfaces and cancels outstanding reminders", () => {
  const h = harness(); h.api.showPet({ body: "quit" }); const { pet, card } = h.pair();
  h.ready(pet); h.ready(card); h.api.scheduleReminder(h.settings); h.api.quitApp();
  assert.equal(pet.destroyed, true); assert.equal(card.destroyed, true); assert.equal(h.timers.size, 0); assert.equal(h.app.quitCalled, true);
});

test("preload exposes only narrow readiness and height messages", () => {
  let bridge; const sent = []; const ipcRenderer = new EventEmitter();
  ipcRenderer.send = (...args) => sent.push(args); ipcRenderer.invoke = () => Promise.resolve();
  vm.runInNewContext(fs.readFileSync(path.join(electronDir, "preload.cjs"), "utf8"), {
    require: () => ({ ipcRenderer, contextBridge: { exposeInMainWorld(name, value) { assert.equal(name, "petDesktop"); bridge = value; } } }),
  });
  bridge.reminderReady(); bridge.resizeReminder(177);
  assert.deepEqual(sent, [["pet:ready"], ["pet:resize-reminder", 177]]);
  let observed = "none"; const remove = bridge.onReminder(value => { observed = value; });
  ipcRenderer.emit("pet:reminder", {}, null); assert.equal(observed, null); remove();
  assert.equal(ipcRenderer.listenerCount("pet:reminder"), 0);
});
