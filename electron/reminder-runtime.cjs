const MINUTE = 60_000;

function intervalMinutes(settings) {
  const value = Number(settings.reminderIntervalMinutes ?? settings.reminderInterval ?? 45);
  return Number.isFinite(value) ? Math.min(1439, Math.max(1, value)) : 45;
}

function timeMinutes(value, fallback) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function activeAt(at, settings) {
  const date = new Date(at);
  const minute = date.getHours() * 60 + date.getMinutes();
  const start = timeMinutes(settings.start, 540), end = timeMinutes(settings.end, 1080);
  if (start === end) return true;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

function nextActiveAt(at, settings) {
  if (activeAt(at, settings)) return at;
  const start = timeMinutes(settings.start, 540);
  const date = new Date(at);
  date.setHours(Math.floor(start / 60), start % 60, 0, 0);
  if (date.getTime() <= at) date.setDate(date.getDate() + 1);
  return date.getTime();
}

function createReminderRuntime({ actions, loadState = () => ({}), saveState = () => {},
  onReminder, onStatus = () => {}, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  if (!actions?.length) throw new Error("At least one reminder action is required");
  let stored;
  try { stored = loadState() || {}; } catch { stored = {}; }
  const state = {
    version: 1, paused: stored.paused === true,
    nextActionIndex: Number.isSafeInteger(stored.nextActionIndex) ? Math.max(0, stored.nextActionIndex) % actions.length : 0,
    lastActionId: stored.lastActionId || null,
    scheduleKey: stored.scheduleKey || null,
    nextReminderAt: Number.isFinite(stored.nextReminderAt) ? stored.nextReminderAt : null,
    nextReason: stored.nextReason === "snooze" ? "snooze" : "scheduled",
    snoozeBody: typeof stored.snoozeBody === "string" ? stored.snoozeBody : null,
    lastReminderAt: Number.isFinite(stored.lastReminderAt) ? stored.lastReminderAt : null,
    history: Array.isArray(stored.history) ? stored.history.slice(-200) : [],
  };
  let settings = {}, timer = null;
  const persist = () => saveState(JSON.parse(JSON.stringify(state)));
  function status() {
    return { enabled: !!settings.restEnabled, paused: state.paused,
      intervalMinutes: intervalMinutes(settings), start: settings.start, end: settings.end,
      nextReminderAt: state.nextReminderAt, nextReason: state.nextReason,
      lastReminderAt: state.lastReminderAt, lastActionId: state.lastActionId };
  }
  function publish() { persist(); onStatus(status()); }
  function cancelTimer() { if (timer !== null) clearTimer(timer); timer = null; }
  function enabled() { return !!settings.restEnabled && !state.paused; }
  function freshDue() {
    const at = now();
    return nextActiveAt(activeAt(at, settings) ? at + intervalMinutes(settings) * MINUTE : at, settings);
  }
  function arm() {
    cancelTimer();
    if (enabled() && state.nextReminderAt !== null) timer = setTimer(tick, Math.max(0, state.nextReminderAt - now()));
  }
  function show(reason = "test", payload = {}, scheduledFor = null) {
    let index = state.nextActionIndex;
    if (actions.length > 1 && actions[index].id === state.lastActionId) index = (index + 1) % actions.length;
    const action = actions[index];
    state.nextActionIndex = (index + 1) % actions.length;
    state.lastActionId = action.id;
    state.lastReminderAt = now();
    const event = { occurredAt: now(), scheduledFor, reason, actionId: action.id };
    state.history.push(event); state.history = state.history.slice(-200);
    const reminder = { ...payload, action: { ...action }, reminderId: `${event.occurredAt}-${state.history.length}-${action.id}` };
    publish();
    onReminder(reminder, event);
    return reminder;
  }
  function tick() {
    timer = null;
    if (!enabled()) return;
    if (!activeAt(now(), settings)) {
      state.nextReminderAt = nextActiveAt(now(), settings); arm(); publish(); return;
    }
    const due = state.nextReminderAt, reason = state.nextReason;
    const body = reason === "snooze" ? state.snoozeBody ?? settings.reminderBody : settings.reminderBody;
    state.snoozeBody = null;
    // A late wake-up produces one reminder, never a burst of missed reminders.
    state.nextReminderAt = freshDue(); state.nextReason = "scheduled";
    arm();
    show(reason, { body }, due);
  }
  function update(nextSettings) {
    settings = { ...nextSettings };
    const key = JSON.stringify([!!settings.restEnabled, settings.start, settings.end, intervalMinutes(settings)]);
    const changed = state.scheduleKey !== key;
    state.scheduleKey = key;
    if (!enabled()) state.nextReminderAt = null;
    else if (changed || state.nextReminderAt === null) {
      state.nextReminderAt = freshDue(); state.nextReason = "scheduled";
    }
    arm(); publish(); return status();
  }
  function setPaused(value) {
    state.paused = value === true;
    return update(settings);
  }
  function snooze(minutes = 15, payload = {}) {
    if (!enabled()) return status();
    const value = Number(minutes);
    const delay = Number.isFinite(value) ? Math.max(1, Math.min(1439, value)) : 15;
    state.nextReminderAt = nextActiveAt(now() + delay * MINUTE, settings);
    state.nextReason = "snooze";
    state.snoozeBody = payload.body ?? settings.reminderBody;
    arm(); publish(); return status();
  }
  return { update, status, show, setPaused, snooze, stop: cancelTimer,
    wake() { arm(); }, history: () => state.history.map(event => ({ ...event })) };
}

module.exports = { createReminderRuntime, intervalMinutes, activeAt, nextActiveAt };
