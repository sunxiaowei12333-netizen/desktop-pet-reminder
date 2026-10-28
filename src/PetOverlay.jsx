import { useEffect, useRef, useState } from "react";
import { Check, Clock3, X } from "lucide-react";
import SmoothPet from "./SmoothPet.jsx";
import fallbackCat from "./assets/cat-companion.png";

export default function PetOverlay() {
  const desktopApi = window.petDesktop;
  const [notice, setNotice] = useState(null);
  const panel = new URLSearchParams(window.location.search).get("surface") === "reminder";
  const content = useRef(null);
  useEffect(() => {
    document.title = panel ? "休息时刻 · 提醒" : "休息时刻 · 小猫";
    document.documentElement.classList.add("pet-window");
    document.body.classList.add("pet-window", panel ? "reminder-surface" : "cat-surface");
    const unsubscribe = desktopApi?.onReminder?.(setNotice);
    desktopApi?.reminderReady?.();
    return () => {
      unsubscribe?.();
      document.documentElement.classList.remove("pet-window");
      document.body.classList.remove("pet-window", "reminder-surface", "cat-surface");
    };
  }, [desktopApi, panel]);
  useEffect(() => {
    if (!panel || !content.current || !notice) return;
    const measure = () => desktopApi?.resizeReminder?.(Math.ceil(content.current.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(content.current); measure();
    return () => observer.disconnect();
  }, [desktopApi, panel, notice]);
  const dismiss = () => { setNotice(null); desktopApi?.dismissReminder?.(); };
  const snooze = () => { setNotice(null); desktopApi?.snoozeReminder?.(15); };
  if (!notice) return null;
  if (!panel) return <div className="cat-stage pet-drag-region">
    <SmoothPet src={notice.action?.gif || notice.action?.src || fallbackCat}
      alt={notice.action?.label || "提醒小猫"} className="desktop-cat" />
  </div>;
  return <div ref={content} className="reminder-card pet-drag-region">
    <div className="reminder-content">
      <span className="reminder-heading">桌面宠物提醒</span>
      <p className="reminder-body">{notice.body}</p>
      <div className="reminder-actions pet-no-drag">
        <button className="reminder-confirm" onClick={dismiss}><Check size={14} />好的</button>
        <button className="reminder-later" onClick={snooze}><Clock3 size={14} />稍后（15分钟）</button>
      </div>
    </div>
    <button className="reminder-close pet-no-drag" onClick={dismiss} aria-label="关闭提醒"><X size={16} /></button>
  </div>;
}
