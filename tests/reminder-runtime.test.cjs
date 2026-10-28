const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReminderRuntime, intervalMinutes } = require('../electron/reminder-runtime.cjs');
const minute = 60_000;
const at = value => new Date(value).getTime();
const allDay = { restEnabled: true, start: '00:00', end: '00:00', reminderIntervalMinutes: 90, reminderBody: 'Drink water' };
function harness(start = '2026-10-28T10:00:00+08:00', initial = {}) {
  let clock = at(start), saved = structuredClone(initial), id = 0;
  const timers = new Map(), events = [];
  const options = {
    actions: ['wave', 'rest', 'look', 'stretch', 'companion', 'blink'].map(id => ({ id, src: `${id}.gif` })),
    loadState: () => saved, saveState: state => { saved = structuredClone(state); },
    now: () => clock, onReminder: (reminder, event) => events.push({ reminder, event }),
    setTimer: (callback, delay) => { timers.set(++id, { callback, due: clock + delay }); return id; },
    clearTimer: id => timers.delete(id),
  };
  let runtime = createReminderRuntime(options);
  function advance(ms) {
    const end = clock + ms;
    let turns = 0;
    while (true) {
      const entry = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
      if (!entry || entry[1].due > end) break;
      assert.ok(++turns < 1000, 'timer storm');
      clock = Math.max(clock, entry[1].due); timers.delete(entry[0]); entry[1].callback();
    }
    clock = end;
  }
  return { get runtime() { return runtime; }, timers, events, advance, now: () => clock,
    get saved() { return saved; },
    restart() { runtime.stop(); runtime = createReminderRuntime(options); runtime.update(allDay); },
    sleep(ms) { clock += ms; runtime.wake(); advance(0); },
  };
}

test('90-minute schedule produces exactly four reminders in six hours, each 90 minutes apart', () => {
  const h = harness(); h.runtime.update(allDay);
  h.advance(90 * minute - 1); assert.equal(h.events.length, 0);
  h.advance(1); assert.equal(h.events.length, 1);
  h.advance(270 * minute); assert.equal(h.events.length, 4);
  for (const [index, { event }] of h.events.entries()) {
    assert.equal(event.occurredAt, at('2026-10-28T10:00:00+08:00') + (index + 1) * 90 * minute);
    assert.equal(event.occurredAt, event.scheduledFor); assert.equal(event.reason, 'scheduled');
  }
  assert.equal(h.timers.size, 1);
});

test('all six actions rotate across automatic, manual and snoozed reminders, including restart', () => {
  const h = harness(); h.runtime.update(allDay);
  for (let i = 0; i < 3; i++) h.runtime.show('test');
  h.restart();
  h.advance(90 * minute); h.runtime.show('test'); h.runtime.snooze(15); h.advance(15 * minute);
  assert.deepEqual(h.events.map(value => value.reminder.action.id), ['wave', 'rest', 'look', 'stretch', 'companion', 'blink']);
  h.runtime.show('test'); assert.equal(h.events.at(-1).reminder.action.id, 'wave');
});

test('09:00–18:00 is enforced and next day starts at 09:00 without an 18:00 reminder', () => {
  const h = harness('2026-10-28T08:30:00+08:00');
  h.runtime.update({ ...allDay, start: '09:00', end: '18:00' });
  assert.equal(h.runtime.status().nextReminderAt, at('2026-10-28T09:00:00+08:00'));
  h.advance(9.5 * 60 * minute);
  assert.equal(h.events.length, 6);
  assert.equal(h.events.at(-1).event.occurredAt, at('2026-10-28T16:30:00+08:00'));
  assert.equal(h.runtime.status().nextReminderAt, at('2026-10-29T09:00:00+08:00'));
  h.advance(15 * 60 * minute); assert.equal(h.events.length, 7);
});

test('pause and disable both stop automatic and snoozed reminders; resume waits a full interval', () => {
  const h = harness(); h.runtime.update(allDay); h.runtime.snooze(15); h.runtime.setPaused(true);
  assert.equal(h.timers.size, 0); assert.equal(h.runtime.status().nextReminderAt, null);
  h.advance(3 * 60 * minute); assert.equal(h.events.length, 0);
  h.restart(); assert.equal(h.timers.size, 0);
  h.runtime.setPaused(false); h.advance(90 * minute - 1); assert.equal(h.events.length, 0);
  h.advance(1); assert.equal(h.events.length, 1);
  h.runtime.update({ ...allDay, restEnabled: false }); h.advance(180 * minute);
  assert.equal(h.events.length, 1); assert.equal(h.timers.size, 0);
});

test('saving text preserves the deadline; changing interval schedules the new interval', () => {
  const h = harness(); h.runtime.update(allDay); const due = h.runtime.status().nextReminderAt;
  h.advance(20 * minute); h.runtime.update({ ...allDay, reminderBody: 'New text' });
  assert.equal(h.runtime.status().nextReminderAt, due);
  h.advance(70 * minute); assert.equal(h.events[0].reminder.body, 'New text');
  h.runtime.update({ ...allDay, reminderIntervalMinutes: 45 });
  h.advance(45 * minute); assert.equal(h.events.length, 2);
});

test('manual tests never add an automatic timer or reset the 90-minute deadline', () => {
  const h = harness(); h.runtime.update(allDay); const due = h.runtime.status().nextReminderAt;
  h.advance(10 * minute); for (let i = 0; i < 12; i++) h.runtime.show('test');
  assert.equal(h.runtime.status().nextReminderAt, due); assert.equal(h.timers.size, 1);
  h.advance(80 * minute); assert.equal(h.events.filter(value => value.event.reason === 'scheduled').length, 1);
});

test('snooze replaces the old timer, then resumes the configured interval without duplicate triggers', () => {
  const h = harness(); h.runtime.update(allDay); h.advance(80 * minute); h.runtime.snooze(15);
  assert.equal(h.timers.size, 1); h.advance(10 * minute); assert.equal(h.events.length, 0);
  h.advance(5 * minute); assert.equal(h.events.length, 1); assert.equal(h.events[0].event.reason, 'snooze');
  h.advance(89 * minute); assert.equal(h.events.length, 1);
  h.advance(minute); assert.equal(h.events.length, 2); assert.equal(h.events[1].event.reason, 'scheduled');
});

test('restart preserves an existing deadline and late wake-up sends one reminder without a backlog burst', () => {
  const h = harness(); h.runtime.update(allDay); const due = h.runtime.status().nextReminderAt;
  h.advance(60 * minute); h.restart(); assert.equal(h.runtime.status().nextReminderAt, due);
  h.sleep(6 * 60 * minute); assert.equal(h.events.length, 1); assert.equal(h.timers.size, 1);
  assert.equal(h.runtime.status().nextReminderAt, h.now() + 90 * minute);
});

test('overnight schedules and snooze crossing the end of the time window respect quiet hours', () => {
  const h = harness('2026-10-28T23:30:00+08:00');
  h.runtime.update({ ...allDay, start: '22:00', end: '06:00' });
  h.advance(390 * minute); assert.equal(h.events.length, 4);
  assert.equal(h.runtime.status().nextReminderAt, at('2026-10-29T22:00:00+08:00'));
  const day = harness('2026-10-28T17:50:00+08:00');
  day.runtime.update({ ...allDay, start: '09:00', end: '18:00' }); day.runtime.snooze(15);
  assert.equal(day.runtime.status().nextReminderAt, at('2026-10-29T09:00:00+08:00'));
});

test('invalid intervals cannot create a tight loop and the audit history stays bounded', () => {
  assert.equal(intervalMinutes({ reminderIntervalMinutes: 'bad' }), 45);
  assert.equal(intervalMinutes({ reminderIntervalMinutes: 0 }), 1);
  assert.equal(intervalMinutes({ reminderInterval: '90' }), 90);
  const h = harness(); h.runtime.update(allDay);
  for (let i = 0; i < 250; i++) h.runtime.show('test');
  assert.equal(h.saved.history.length, 200); assert.equal(h.timers.size, 1);
});
