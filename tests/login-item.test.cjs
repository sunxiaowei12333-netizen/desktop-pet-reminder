const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoginItemController } = require('../electron/login-item.cjs');

test('login preference follows macOS, including external changes, without touching reminder settings', () => {
  let system = { openAtLogin: false, status: 'not-registered' }, writes = [];
  const app = { isPackaged: true, getLoginItemSettings: () => system, setLoginItemSettings: value => {
    writes.push(value); system = { openAtLogin: value.openAtLogin, status: value.openAtLogin ? 'enabled' : 'not-registered' };
  } };
  const controller = createLoginItemController(app, 'darwin');
  assert.equal(controller.get().enabled, false); assert.deepEqual(writes, []);
  assert.equal(controller.set(true).enabled, true);
  system = { openAtLogin: false, status: 'not-registered' };
  assert.equal(controller.get().enabled, false);
  controller.set(true); assert.equal(controller.set(false).enabled, false);
  assert.deepEqual(writes, [{ openAtLogin: true }, { openAtLogin: true }, { openAtLogin: false }]);
});

test('approval-required registration is reported as pending, not successful enablement', () => {
  const controller = createLoginItemController({ isPackaged: true,
    getLoginItemSettings: () => ({ openAtLogin: false, status: 'requires-approval' }), setLoginItemSettings() {},
  }, 'darwin');
  assert.deepEqual(controller.set(true), { supported: true, enabled: true, status: 'requires-approval' });
  assert.throws(() => controller.set(false), /系统未应用/);
});

test('invalid, unsupported and rejected changes never pretend to succeed', () => {
  let calls = 0;
  const app = { isPackaged: false, setLoginItemSettings() { calls++; }, getLoginItemSettings: () => ({ openAtLogin: false }) };
  const dev = createLoginItemController(app, 'darwin');
  assert.equal(dev.get().supported, false); assert.throws(() => dev.set(true), /macOS/);
  app.isPackaged = true;
  const other = createLoginItemController(app, 'linux'); assert.throws(() => other.set(true), /macOS/);
  const installed = createLoginItemController(app, 'darwin');
  assert.throws(() => installed.set('true'), TypeError); assert.equal(calls, 0);
  assert.throws(() => installed.set(true), /系统未应用/);
  app.setLoginItemSettings = () => { throw Error('OS failure'); };
  assert.throws(() => installed.set(true), /OS failure/);
});
