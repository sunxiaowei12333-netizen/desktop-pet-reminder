import { useEffect, useState } from "react";

export function formatReminderTime(status) {
  if (!status) return "—";
  if (status.paused) return "已暂停";
  if (!status.enabled) return "已关闭";
  if (!status.nextReminderAt) return "—";
  const next = new Date(status.nextReminderAt), today = new Date();
  const clock = next.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (next.toDateString() === today.toDateString()) return clock;
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  return next.toDateString() === tomorrow.toDateString() ? `明天 ${clock}` : `${next.getMonth() + 1}/${next.getDate()} ${clock}`;
}

export default function useReminderSchedule(desktopApi, setPaused) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let active = true;
    const receive = value => {
      if (active && value) { setStatus(value); setPaused(value.paused === true); }
    };
    const unsubscribe = desktopApi?.onReminderStatus?.(receive);
    desktopApi?.getReminderStatus?.().then(receive).catch(error => console.warn("Could not read reminder schedule", error));
    return () => { active = false; unsubscribe?.(); };
  }, [desktopApi, setPaused]);
  return status;
}
