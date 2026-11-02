// macOS owns this preference. Never cache it in reminder settings or overwrite
// a change made in System Settings when the app starts.
function createLoginItemController(app, platform = process.platform) {
  const supported = platform === "darwin" && app.isPackaged;
  function get() {
    if (!supported) return { supported: false, enabled: false, status: "unavailable" };
    const item = app.getLoginItemSettings();
    const status = item.status || (item.openAtLogin ? "enabled" : "not-registered");
    return { supported: true, enabled: status === "requires-approval" || Boolean(item.openAtLogin), status };
  }
  function set(enabled) {
    if (typeof enabled !== "boolean") throw new TypeError("开机自启动设置必须是开或关");
    if (!supported) throw new Error("请在已安装的 macOS App 中设置开机自启动");
    app.setLoginItemSettings({ openAtLogin: enabled });
    const result = get();
    if (result.enabled !== enabled) throw new Error("系统未应用更改，请在系统设置的“登录项”中检查休息时刻");
    return result;
  }
  return { get, set };
}
module.exports = { createLoginItemController };
