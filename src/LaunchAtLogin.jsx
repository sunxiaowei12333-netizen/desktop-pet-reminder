import { useEffect, useRef, useState } from "react";
import { Power } from "lucide-react";

export default function LaunchAtLogin({ desktopApi }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changing = useRef(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (changing.current) return;
      try {
        const value = await desktopApi?.getLaunchAtLogin?.();
        if (active && !changing.current) { setState(value || { supported: false, enabled: false }); setError(""); }
      } catch {
        if (active) setError("暂时无法读取开机自启动状态，请重新打开设置。");
      }
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [desktopApi]);

  const toggle = async () => {
    if (changing.current || !state?.supported) return;
    changing.current = true; setBusy(true); setError("");
    try { setState(await desktopApi.setLaunchAtLogin(!state.enabled)); }
    catch {
      setError("未能更改，请在系统设置 → 通用 → 登录项中检查“休息时刻”。");
      try { setState(await desktopApi.getLaunchAtLogin()); } catch { /* Keep the last confirmed state. */ }
    } finally { changing.current = false; setBusy(false); }
  };
  const description = !state ? "正在读取系统设置…"
    : !state.supported ? "请在已安装的 macOS App 中设置。"
    : state.status === "requires-approval" ? "请在系统设置 → 通用 → 登录项中允许“休息时刻”。"
    : "登录 Mac 后自动启动休息提醒，更改立即生效。";
  return <section className="mt-5 border-t border-white/55 pt-4" aria-label="启动设置">
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/65 bg-white/45 px-3 py-3 backdrop-blur-xl">
      <div className="min-w-0">
        <p id="launch-at-login-label" className="inline-flex items-center gap-2 text-[11px] text-slate-600"><Power size={14} />开机自启动</p>
        <p id="launch-at-login-description" className="mt-1 text-[10px] leading-relaxed text-slate-500">{busy ? "正在更新系统设置…" : description}</p>
      </div>
      <button type="button" role="switch" aria-checked={Boolean(state?.enabled)}
        aria-labelledby="launch-at-login-label" aria-describedby="launch-at-login-description"
        disabled={busy || !state?.supported} onClick={toggle}
        className={`relative h-[18px] w-[32px] shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-50 ${state?.enabled ? "bg-teal-400" : "bg-slate-300"}`}>
        <span className={`absolute top-[3px] size-3 rounded-full bg-white shadow-sm transition-all ${state?.enabled ? "left-[17px]" : "left-[3px]"}`} />
      </button>
    </div>
    {error && <p role="alert" className="mt-2 text-[10px] leading-relaxed text-amber-700">{error}</p>}
  </section>;
}
