import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Check,
  Clock3,
  Coffee,
  ImagePlus,
  Pause,
  Play,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import catCompanion from "./assets/cat-companion.png";
import "./styles.css";

const initialSettings = {
  restEnabled: true,
  start: "09:00",
  end: "18:00",
  reminderInterval: "45",
  restWork: "50",
  restDuration: "10",
  reminderBody: "离开屏幕 10 分钟，让眼睛和肩颈松一松。",
};

const companionActions = [
  {
    label: "挥手提醒",
    sourceKey: "front",
    crop: [0.02, 0.02, 0.6, 0.68],
    rotate: -8,
    zoom: 1.08,
    skew: -0.08,
    mirror: false,
    tint: "from-sky-50/80 to-white/65",
    wash: ["rgba(186,230,253,0.20)", "rgba(255,255,255,0)"],
  },
  {
    label: "趴下休息",
    sourceKey: "calm",
    crop: [0.1, 0.2, 0.8, 0.6],
    rotate: 3,
    zoom: 1.14,
    skew: 0.03,
    mirror: false,
    tint: "from-emerald-50/80 to-white/65",
    wash: ["rgba(187,247,208,0.18)", "rgba(255,255,255,0)"],
  },
  {
    label: "侧身看看",
    sourceKey: "left",
    crop: [0.28, 0.06, 0.56, 0.76],
    rotate: 8,
    zoom: 1.12,
    skew: 0.08,
    mirror: true,
    tint: "from-rose-50/80 to-white/65",
    wash: ["rgba(254,205,211,0.18)", "rgba(255,255,255,0)"],
  },
  {
    label: "伸懒腰",
    sourceKey: "stretch",
    crop: [0.04, 0.14, 0.88, 0.68],
    rotate: -6,
    zoom: 1.18,
    skew: -0.04,
    mirror: false,
    tint: "from-amber-50/80 to-white/65",
    wash: ["rgba(253,230,138,0.18)", "rgba(255,255,255,0)"],
  },
  {
    label: "安静陪伴",
    sourceKey: "front",
    crop: [0.12, 0.1, 0.72, 0.74],
    rotate: 0,
    zoom: 1.04,
    skew: 0,
    mirror: false,
    tint: "from-slate-50/75 to-white/65",
    wash: ["rgba(226,232,240,0.18)", "rgba(255,255,255,0)"],
  },
  {
    label: "眨眼提示",
    sourceKey: "right",
    crop: [0.22, 0.02, 0.56, 0.8],
    rotate: 5,
    zoom: 1.16,
    skew: 0.06,
    mirror: true,
    tint: "from-cyan-50/80 to-white/65",
    wash: ["rgba(165,243,252,0.18)", "rgba(255,255,255,0)"],
  },
];

const petCutoutSize = 1024;

const buttonBase =
  "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-white/65 bg-white/45 px-3.5 text-[11px] font-medium text-slate-600 shadow-[0_10px_24px_rgba(148,163,184,0.08)] backdrop-blur-2xl transition hover:-translate-y-px hover:bg-white/70 hover:text-slate-950";
const primaryButton =
  "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-slate-950/5 bg-slate-950 px-3.5 text-[11px] font-medium text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] transition hover:-translate-y-px hover:bg-slate-800";

const fieldBase =
  "h-9 w-full rounded-2xl border border-white/75 bg-white/68 px-3 text-[11px] text-slate-800 shadow-[0_8px_20px_rgba(148,163,184,0.06)] outline-none transition placeholder:text-slate-300 focus:border-sky-300/70 focus:ring-4 focus:ring-sky-100/60";

const identityViewSpecs = [
  {
    key: "front",
    label: "正面视图",
    note: "最居中、最稳定的一张",
    summary: "更像日常盯着你的样子",
  },
  {
    key: "left",
    label: "左侧视图",
    note: "左脸和轮廓更明显",
    summary: "侧身时的线条更清楚",
  },
  {
    key: "right",
    label: "右侧视图",
    note: "右脸和眼神更突出",
    summary: "右边角度更容易被识别",
  },
  {
    key: "calm",
    label: "安静姿态",
    note: "体态最放松的一张",
    summary: "更接近日常趴卧状态",
  },
  {
    key: "stretch",
    label: "动态姿态",
    note: "肢体展开更明显",
    summary: "适合做“伸懒腰”动作",
  },
];

const petAssetsStorageKey = "rest-moment.pet-assets.v1";

function readLocalPetAssets() {
  try {
    const raw = window.localStorage.getItem(petAssetsStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalPetAssets(assets) {
  try {
    window.localStorage.setItem(petAssetsStorageKey, JSON.stringify(assets));
  } catch {
    // In the web preview localStorage may be too small for 10 full-resolution photos.
    // The packaged desktop app persists through the Electron userData file instead.
  }
}

function Root() {
  const surface = new URLSearchParams(window.location.search).get("surface");
  if (surface === "pet") return <PetOverlay />;
  return <App />;
}

function App() {
  const desktopApi = window.petDesktop;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("reminder");
  const [settings, setSettings] = useState(initialSettings);
  const [draft, setDraft] = useState(initialSettings);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [generatedVariants, setGeneratedVariants] = useState([]);
  const [saved, setSaved] = useState(false);
  const [analysisState, setAnalysisState] = useState({
    active: false,
    progress: 0,
    stage: "",
    detail: "",
  });
  const [generationStatus, setGenerationStatus] = useState({
    state: "idle",
    message: "正在检查本地生成服务",
  });
  const [toast, setToast] = useState(null);
  const [petSticker, setPetSticker] = useState(catCompanion);
  const [petProfile, setPetProfile] = useState(null);
  const inputRef = useRef(null);
  const savedTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const analysisRunRef = useRef(0);
  const actionCursorRef = useRef(0);
  const snoozeTimerRef = useRef(null);

  useEffect(() => {
    document.title = "休息时刻";
    return () => {
      clearTimeout(savedTimerRef.current);
      clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!desktopApi?.getSettings) return;
    desktopApi.getSettings().then((storedSettings) => {
      setSettings(storedSettings);
      setDraft(storedSettings);
    });
  }, [desktopApi]);

  useEffect(() => {
    let cancelled = false;
    const loadGenerationStatus = async () => {
      if (!desktopApi?.getGenerationStatus) return;
      const status = await desktopApi.getGenerationStatus();
      if (!cancelled && status) setGenerationStatus(status);
    };
    loadGenerationStatus();
    return () => {
      cancelled = true;
    };
  }, [desktopApi]);

  useEffect(() => {
    let cancelled = false;
    const loadStoredAssets = async () => {
      const storedAssets = desktopApi?.getPetAssets
        ? await desktopApi.getPetAssets()
        : readLocalPetAssets();
      if (cancelled || !storedAssets) return;
      if (storedAssets.photos?.length) setPhotos(storedAssets.photos.slice(0, 10));
      if (storedAssets.primarySticker) setPetSticker(storedAssets.primarySticker);
      if (storedAssets.variants?.length) setGeneratedVariants(storedAssets.variants);
      if (storedAssets.profile) setPetProfile(storedAssets.profile);
    };
    loadStoredAssets();
    return () => {
      cancelled = true;
    };
  }, [desktopApi]);

  const previewVariants = generatedVariants.length
    ? generatedVariants
    : companionActions.map((action) => ({ ...action, src: null, pending: true }));

  const statusLabel = paused ? "今日已暂停" : settings.restEnabled ? "提醒运行中" : "提醒已关闭";
  const panelStatus = paused ? "已暂停" : draft.restEnabled ? "运行中" : "已关闭";

  const openPanel = () => {
    setDraft(settings);
    setOpen(true);
    setSaved(false);
  };

  const closePanel = () => setOpen(false);

  useEffect(() => () => clearTimeout(snoozeTimerRef.current), []);

  const pushToast = (message, tone = "success") => {
    setToast({ message, tone });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  };

  const savePanel = async () => {
    const nextSettings = { ...draft };
    setSettings(nextSettings);
    desktopApi?.saveSettings?.(nextSettings);
    setSaved(true);
    pushToast(photos.length ? `保存成功，开始分析 ${photos.length} 张参考图` : "保存成功");
    if (!photos.length) {
      setAnalysisState({
        active: false,
        progress: 0,
        stage: "",
        detail: "",
      });
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 1400);
      return;
    }

    const runId = analysisRunRef.current + 1;
    analysisRunRef.current = runId;
    setAnalysisState({
      active: true,
      progress: 0.06,
      stage: "正在整理参考图",
      detail: `共 ${photos.length} 张照片`,
    });

    const sourcePool = photos.map((photo) => photo.src);
    const result = await generatePetAssets(sourcePool, (progress, stage, detail) => {
      if (analysisRunRef.current !== runId) return;
      setAnalysisState({
        active: progress < 1,
        progress,
        stage,
        detail,
      });
    }, desktopApi);

    if (analysisRunRef.current !== runId || !result) return;
    if (result.status === "needs_configuration") {
      const autoStatus = desktopApi?.ensureGenerationService ? await desktopApi.ensureGenerationService() : null;
      if (autoStatus) setGenerationStatus(autoStatus);
      pushToast("正在自动启动本地生成服务", "warning");
      setAnalysisState({
        active: true,
        progress: 0.12,
        stage: autoStatus?.state === "ready" ? "本地生成服务已就绪，准备重试" : "正在自动启动本地生成服务",
        detail:
          result.message ||
          autoStatus?.message ||
          "当前程序会先尝试自动拉起本地生成服务；如果第一次没找到引擎，会给出清晰提示。",
      });
      return;
    }

    setPetSticker(result.primarySticker);
    setGeneratedVariants(result.variants);
    setPetProfile(result.profile);
    const assetPayload = {
      photos,
      profile: result.profile,
      variants: result.variants,
      primarySticker: result.primarySticker,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (desktopApi?.savePetAssets) {
        await desktopApi.savePetAssets(assetPayload);
      } else {
        writeLocalPetAssets(assetPayload);
      }
    } catch {
      writeLocalPetAssets(assetPayload);
    }
    setAnalysisState({
      active: false,
      progress: 1,
      stage: "分析完成",
      detail: `${result.profile.references} 张参考图 · ${result.variants.length} 个动作`,
    });
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1400);
  };

  const showReminder = (source = open ? draft : settings) => {
    const action = previewVariants[actionCursorRef.current % previewVariants.length] || {
      label: "小猫提醒",
      src: petSticker,
    };
    actionCursorRef.current += 1;
    const reminder = {
      body: source.reminderBody,
      action,
    };

    if (desktopApi?.showReminder) {
      desktopApi.showReminder(reminder);
      return;
    }

    setNotice(reminder);
  };

  const snoozeReminder = () => {
    const reminderSource = {
      reminderBody: notice?.body || (open ? draft : settings).reminderBody,
    };
    dismissNotice();
    clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current = setTimeout(() => {
      showReminder(reminderSource);
    }, 15 * 60 * 1000);
  };

  const dismissNotice = () => {
    clearTimeout(snoozeTimerRef.current);
    setNotice(null);
  };

  const addPhotos = (event) => {
    const incoming = Array.from(event.target.files || []).slice(0, 10 - photos.length);
    incoming.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos((current) => [
          ...current,
          {
            id: `${file.name}-${file.lastModified}`,
            name: file.name,
            src: reader.result,
          },
        ].slice(0, 10));
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const removePhoto = (id) => setPhotos((current) => current.filter((photo) => photo.id !== id));
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_14%_0%,rgba(219,240,249,0.95),transparent_32%),linear-gradient(180deg,#f9fbfc_0%,#edf2f5_48%,#e5ebef_100%)] p-5 text-slate-950 sm:p-6">
      <div className="relative z-10 flex items-center gap-3">
        <button
          className="grid size-11 place-items-center rounded-[1.35rem] border border-white/75 bg-white/68 text-slate-700 shadow-[0_18px_40px_rgba(148,163,184,0.14)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/84 hover:text-slate-950"
          onClick={open ? closePanel : openPanel}
          aria-label="打开休息时刻"
        >
          <Coffee size={18} strokeWidth={2.2} />
        </button>
        <div className="leading-tight">
          <strong className="block text-xs font-semibold tracking-tight">休息时刻</strong>
          <span className="mt-1 block text-[10px] text-slate-500">{statusLabel}</span>
        </div>
      </div>

      {toast && (
        <div className="fixed right-4 top-4 z-50 max-w-[320px] rounded-[1.35rem] border border-white/80 bg-white/72 px-4 py-3 shadow-[0_20px_60px_rgba(148,163,184,0.18)] backdrop-blur-2xl">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 grid size-7 place-items-center rounded-full ${toast.tone === "success" ? "bg-emerald-500/12 text-emerald-600" : "bg-amber-500/12 text-amber-600"}`}>
              <Check size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-950">{toast.message}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{toast.tone === "success" ? "你的设置已经存好，马上进入分析。" : "这一步需要真实模型服务，不能用前端假生成。"}</p>
            </div>
          </div>
        </div>
      )}

      {(analysisState.active || analysisState.progress > 0) && (
        <div className="fixed left-1/2 top-4 z-[70] w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 rounded-[1.45rem] border border-white/80 bg-white/76 px-4 py-3 shadow-[0_22px_70px_rgba(88,110,130,0.2)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-sky-500/70">本地生成队列</p>
              <p className="mt-1 truncate text-[12px] font-medium text-slate-950">{analysisState.stage || "等待开始"}</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/80 bg-white/76 px-2.5 py-1 text-[10px] font-medium text-slate-500">
              {Math.round((analysisState.progress || 0) * 100)}%
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100/90">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-300 transition-[width] duration-300"
              style={{ width: `${Math.max(6, Math.min(100, (analysisState.progress || 0) * 100))}%` }}
            />
          </div>
          <p className="mt-2 truncate text-[10px] text-slate-500">{analysisState.detail || "上传参考图后，先生成五视图，再生成六个动作。"}</p>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-center bg-white/18 px-3 pb-3 pt-14 backdrop-blur-[18px]"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && closePanel()}
        >
          <section
            className="flex max-h-[calc(100dvh-72px)] w-full max-w-[448px] flex-col overflow-hidden rounded-[34px] border border-white/75 bg-white/54 shadow-[0_30px_90px_rgba(148,163,184,0.14)] backdrop-blur-[42px]"
            role="dialog"
            aria-modal="true"
            aria-label="休息时刻"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/55 px-5 pb-4 pt-5">
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">菜单栏小工具</p>
                <h1 className="text-[18px] font-medium leading-tight tracking-[-0.05em] text-slate-950">
                  轻轻提醒你休息一下。
                </h1>
              </div>
              <button
                className="grid size-8 shrink-0 place-items-center rounded-full border border-white/65 bg-white/55 text-slate-400 transition hover:bg-white/80 hover:text-slate-900"
                onClick={closePanel}
                aria-label="关闭窗口"
              >
                <X size={17} />
              </button>
            </header>

            <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
              <div className="rounded-[1.4rem] border border-white/70 bg-white/40 p-3.5 shadow-[0_14px_28px_rgba(148,163,184,0.08)] backdrop-blur-xl">
                <span className="text-[10px] text-slate-400">下一次提醒</span>
                <strong className="mt-2 block text-[26px] font-medium leading-none tracking-[-0.06em] text-slate-900">
                  10:30
                </strong>
                <p className="mt-2 text-[10px] text-slate-400">间隔 {draft.reminderInterval} 分钟</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/70 bg-white/40 p-3.5 shadow-[0_14px_28px_rgba(148,163,184,0.08)] backdrop-blur-xl">
                <span className="text-[10px] text-slate-400">今日状态</span>
                <strong className="mt-2 block text-[25px] font-medium leading-none tracking-[-0.06em] text-slate-900">
                  {panelStatus}
                </strong>
                <p className="mt-2 text-[10px] text-slate-400">{saved ? "设置已保存" : "本地优先"}</p>
              </div>
            </div>

            <div className="mx-5 mt-4 grid grid-cols-2 rounded-full border border-white/70 bg-white/38 p-1 backdrop-blur-xl">
              <button
                className={`h-9 rounded-full text-[11px] outline-none transition focus-visible:ring-2 focus-visible:ring-sky-200/70 ${tab === "reminder" ? "bg-white font-medium text-slate-950 shadow-[0_10px_20px_rgba(148,163,184,0.14)]" : "font-normal text-slate-500 hover:text-slate-900"}`}
                onClick={() => setTab("reminder")}
              >
                设置提醒
              </button>
              <button
                className={`h-9 rounded-full text-[11px] outline-none transition focus-visible:ring-2 focus-visible:ring-sky-200/70 ${tab === "shape" ? "bg-white font-medium text-slate-950 shadow-[0_10px_20px_rgba(148,163,184,0.14)]" : "font-normal text-slate-500 hover:text-slate-900"}`}
                onClick={() => setTab("shape")}
              >
                设置形象
              </button>
            </div>

            {tab === "reminder" && (
              <div className="overflow-auto px-5 pb-4 pt-4">
                <section className="space-y-3.5">
                  <SectionHead number="01" title="提醒时间" description="把提醒节奏改成你不会抗拒的样子。" />

                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="开始时间">
                      <input className={fieldBase} type="time" value={draft.start} onChange={(event) => update("start", event.target.value)} />
                    </Field>
                    <Field label="结束时间">
                      <input className={fieldBase} type="time" value={draft.end} onChange={(event) => update("end", event.target.value)} />
                    </Field>
                    <Field label="提醒间隔">
                      <select className={fieldBase} value={draft.reminderInterval} onChange={(event) => update("reminderInterval", event.target.value)}>
                        <option value="30">每 30 分钟</option>
                        <option value="45">每 45 分钟</option>
                        <option value="60">每 60 分钟</option>
                      </select>
                    </Field>
                    <Field label="休息时长">
                      <select className={fieldBase} value={draft.restDuration} onChange={(event) => update("restDuration", event.target.value)}>
                        <option value="5">5 分钟</option>
                        <option value="10">10 分钟</option>
                        <option value="15">15 分钟</option>
                      </select>
                    </Field>
                  </div>

                  <label className="flex min-h-10 items-center justify-between rounded-2xl border border-white/65 bg-white/45 px-3 text-[11px] text-slate-600 backdrop-blur-xl">
                    <span className="inline-flex items-center gap-2">
                      <Coffee size={14} />
                      休息提醒
                    </span>
                    <input
                      className="relative h-[18px] w-[32px] appearance-none rounded-full bg-slate-300 transition after:absolute after:left-[3px] after:top-[3px] after:size-3 after:rounded-full after:bg-white after:shadow-sm after:transition checked:bg-teal-400 checked:after:left-[17px]"
                      type="checkbox"
                      checked={draft.restEnabled}
                      onChange={(event) => update("restEnabled", event.target.checked)}
                    />
                  </label>
                </section>

                <section className="mt-5 space-y-3.5 border-t border-white/55 pt-4">
                  <SectionHead number="02" title="提醒正文" description="这句话会直接显示在小猫提醒里。" />
                  <Field label="提醒正文">
                    <textarea
                      className="min-h-16 w-full resize-y rounded-2xl border border-white/75 bg-white/68 px-3 py-2 text-[11px] leading-relaxed text-slate-800 outline-none shadow-[0_8px_20px_rgba(148,163,184,0.06)] transition focus:border-sky-300/70 focus:ring-4 focus:ring-sky-100/60"
                      maxLength="60"
                      value={draft.reminderBody}
                      onChange={(event) => update("reminderBody", event.target.value)}
                    />
                  </Field>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="mr-auto text-[10px] text-slate-400">快速操作</span>
                    <button className={buttonBase} onClick={() => showReminder(draft)}>
                      <Bell size={14} />
                      测试提醒
                    </button>
                    <button className={buttonBase} onClick={() => setPaused((value) => !value)}>
                      {paused ? <Play size={14} /> : <Pause size={14} />}
                      {paused ? "恢复" : "暂停"}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {tab === "shape" && (
              <div className="overflow-auto px-5 pb-4 pt-4">
                <section className="space-y-3.5">
                  <SectionHead number="03" title="提醒形象" description="宠物或人像都可以，最多 10 张参考图。" />

                  <button
                    className="group relative flex min-h-24 w-full items-center gap-4 overflow-hidden rounded-[1.7rem] border border-dashed border-sky-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(232,246,252,0.74))] px-4 py-4 text-left shadow-[0_18px_42px_rgba(148,163,184,0.12)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-white/88"
                    onClick={() => inputRef.current?.click()}
                  >
                    <span className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(125,211,252,0.18),transparent_28%),radial-gradient(circle_at_82%_80%,rgba(167,243,208,0.18),transparent_30%)]" />
                    <span className="relative grid size-14 shrink-0 place-items-center rounded-[1.25rem] border border-white/80 bg-white/72 text-sky-500 shadow-[0_12px_24px_rgba(125,211,252,0.18)] transition group-hover:scale-[1.03]">
                      <ImagePlus size={24} />
                    </span>
                    <span className="relative min-w-0">
                      <span className="block text-[13px] font-medium tracking-[-0.02em] text-slate-950">上传猫咪参考照片</span>
                      <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">
                        最多 10 张，建议包含正脸、左右侧脸、趴卧、站立或走动，这样本地模型才能生成更稳定的五视图。
                      </span>
                      <span className="mt-2 inline-flex rounded-full border border-white/80 bg-white/68 px-2.5 py-1 text-[9px] font-medium text-slate-500">
                        已上传 {photos.length}/10 · JPG / PNG
                      </span>
                    </span>
                  </button>

                  {generationStatus?.state && generationStatus.state !== "idle" && (
                    <div className="rounded-[1.35rem] border border-white/70 bg-white/50 px-4 py-3 text-[10px] text-slate-500 backdrop-blur-xl">
                      <span className="inline-flex items-center gap-2 font-medium text-slate-700">
                        <span
                          className={`size-2 rounded-full ${
                            generationStatus.state === "ready"
                              ? "bg-emerald-400"
                              : generationStatus.state === "starting"
                                ? "bg-amber-400"
                                : "bg-slate-300"
                          }`}
                        />
                        {generationStatus.state === "ready" ? "本地生成服务已就绪" : generationStatus.state === "starting" ? "正在自动启动本地生成服务" : "未找到本地生成引擎"}
                      </span>
                      <p className="mt-1 leading-relaxed">{generationStatus.message}</p>
                    </div>
                  )}

                  <div className="relative overflow-hidden rounded-[1.8rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(235,244,250,0.72)_52%,rgba(227,236,242,0.88))] p-4 shadow-[0_18px_34px_rgba(148,163,184,0.1)] backdrop-blur-xl">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.85),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(191,219,254,0.45),transparent_20%),radial-gradient(circle_at_74%_80%,rgba(209,250,229,0.35),transparent_24%)]" />
                    <div className="relative flex h-44 items-end justify-between">
                      <div className="max-w-[52%] pb-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">桌面角落预览</p>
                        <h3 className="mt-2 text-[14px] font-medium tracking-[-0.03em] text-slate-900">本地模型生成的小猫会以透明背景待在桌面右上角。</h3>
                        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">气泡里只有提醒正文，点“已完成”关闭，点“稍后” 15 分钟后再回来。</p>
                      </div>
                      <div className="relative flex items-end justify-end pb-1">
                        <div className="absolute -right-6 top-10 h-16 w-16 rounded-full bg-white/60 blur-2xl" />
                        <img
                          className="h-36 w-36 select-none object-contain drop-shadow-[0_24px_26px_rgba(15,23,42,0.18)] motion-safe:animate-[pet-float_5s_ease-in-out_infinite]"
                          src={previewVariants[0]?.src || petSticker}
                          alt="桌面小猫预览"
                        />
                      </div>
                    </div>
                    <div className="relative mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/55 px-2.5 py-1 text-[9px] text-slate-500 backdrop-blur-xl">
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: petProfile?.dominantColor || "#34d399" }} />
                        {petProfile?.generator || "本地模型待生成"} / {petProfile?.references || photos.length || 1} 张参考
                      </div>
                      <button className={buttonBase} onClick={() => showReminder(draft)}>
                        <Sparkles size={14} />
                        预览
                      </button>
                    </div>
                  </div>

                  <section className="space-y-2.5">
                    <SectionHead number="04" title="五视图生成" description="用 10 张参考图先生成统一猫咪身份的 5 个透明背景视图。" />
                    <div className="grid grid-cols-5 gap-2">
                      {(petProfile?.views || identityViewSpecs).map((view) => (
                        <IdentityViewCard key={view.key} view={view} />
                      ))}
                    </div>
                  </section>

                  <section className="space-y-2.5">
                    <SectionHead number="05" title="六个动作" description="再基于五视图调用本地生成工作流，生成 6 个一致身份的透明动作图。" />
                    <div className="grid grid-cols-3 gap-2.5">
                      {previewVariants.map((action) => (
                        <CatPose key={action.label} action={action} />
                      ))}
                    </div>
                  </section>

                  <section className="space-y-2.5">
                    <SectionHead number="06" title="我的图片" description="你上传的参考照会保留在这里，方便确认这 10 张图有没有上传完整。" />
                    {photos.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2.5">
                        {photos.map((photo) => (
                          <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100" key={photo.id}>
                            <img className="size-full object-cover" src={photo.src} alt={photo.name} />
                            <button
                              className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-lg bg-slate-950/55 text-white transition hover:bg-slate-950/80"
                              onClick={() => removePhoto(photo.id)}
                              aria-label={`删除 ${photo.name}`}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[1.5rem] border border-dashed border-white/70 bg-white/45 px-4 py-5 text-[10px] text-slate-400 backdrop-blur-xl">
                        还没有上传图片。
                      </div>
                    )}
                  </section>
                </section>
              </div>
            )}

            <footer className="flex items-center justify-between gap-3 border-t border-white/55 px-5 py-4">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] text-slate-400">
                <Settings2 size={14} />
                顶部图标内打开设置
              </span>
              <div className="flex gap-2">
                <button className={buttonBase} onClick={closePanel}>关闭</button>
                <button className={primaryButton} onClick={savePanel}>
                  <Check size={14} />
                  保存并分析
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/heic"
        multiple
        onChange={addPhotos}
      />

      {notice && (
        <div className="fixed right-4 top-4 z-50 flex items-start gap-3">
          <div className="relative mt-8 flex min-w-[250px] max-w-[320px] items-start rounded-[1.6rem] border border-white/76 bg-white/68 p-3.5 shadow-[0_18px_50px_rgba(41,53,66,0.16)] backdrop-blur-2xl">
            <div className="min-w-0 pr-2">
              <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-500/70">桌面宠物提醒</span>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{notice.body}</p>
              <div className="mt-3 flex gap-2">
                <button className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-slate-950 px-2.5 text-[10px] font-semibold text-white" onClick={dismissNotice}>
                  <Check size={13} />
                  已完成
                </button>
                <button className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-[10px] font-semibold text-slate-500 shadow-[0_8px_18px_rgba(148,163,184,0.12)]" onClick={snoozeReminder}>
                  <Clock3 size={13} />
                  稍后
                </button>
              </div>
            </div>
            <button
              className="grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
              onClick={dismissNotice}
              aria-label="关闭提醒"
            >
              <X size={15} />
            </button>
          </div>
          <div className="relative -ml-2 mt-0">
            <div className="absolute -right-2 top-14 h-8 w-8 rounded-full bg-white/55 blur-xl" />
            <img
              className="h-[164px] w-[164px] select-none object-contain drop-shadow-[0_30px_34px_rgba(15,23,42,0.28)] motion-safe:animate-[pet-pop_460ms_cubic-bezier(.2,.84,.18,1)]"
              src={notice.action?.src || petSticker}
              alt={notice.action?.label || "提醒小猫"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHead({ number, title, description }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-[-0.03em] text-slate-950">{title}</h2>
        <p className="mt-1 text-[10px] text-slate-400">{description}</p>
      </div>
      <span className="text-[11px] text-slate-300">{number}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1.5 text-[10px] text-slate-500">
      <span>{label}</span>
      {children}
    </label>
  );
}

function PetOverlay() {
  const desktopApi = window.petDesktop;
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    document.documentElement.classList.add("pet-window");
    document.body.classList.add("pet-window");
    const dispose = desktopApi?.onReminder?.((reminder) => {
      setNotice(reminder);
    });
    return () => {
      document.documentElement.classList.remove("pet-window");
      document.body.classList.remove("pet-window");
      dispose?.();
    };
  }, [desktopApi]);

  const dismiss = () => {
    setNotice(null);
    desktopApi?.dismissReminder?.();
  };

  const snooze = () => {
    setNotice(null);
    desktopApi?.snoozeReminder?.(15);
  };

  if (!notice) {
    return <div className="h-dvh w-dvw bg-transparent" />;
  }

  return (
    <div className="h-dvh w-dvw overflow-hidden bg-transparent">
      <div className="absolute right-0 top-0 flex items-start gap-3 bg-transparent p-2">
        <div className="relative mt-8 flex min-w-[250px] max-w-[320px] items-start rounded-[1.6rem] border border-white/76 bg-white/68 p-3.5 shadow-[0_18px_50px_rgba(41,53,66,0.16)] backdrop-blur-2xl">
          <div className="min-w-0 pr-2">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-500/70">桌面宠物提醒</span>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{notice.body}</p>
            <div className="mt-3 flex gap-2">
              <button className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-slate-950 px-2.5 text-[10px] font-semibold text-white" onClick={dismiss}>
                <Check size={13} />
                已完成
              </button>
              <button className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-[10px] font-semibold text-slate-500 shadow-[0_8px_18px_rgba(148,163,184,0.12)]" onClick={snooze}>
                <Clock3 size={13} />
                稍后
              </button>
            </div>
          </div>
          <button
            className="grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={dismiss}
            aria-label="关闭提醒"
          >
            <X size={15} />
          </button>
        </div>
        <div className="relative -ml-2">
          <div className="absolute -right-2 top-14 h-8 w-8 rounded-full bg-white/55 blur-xl" />
          <img
            className="h-[164px] w-[164px] select-none object-contain drop-shadow-[0_30px_34px_rgba(15,23,42,0.28)] motion-safe:animate-[pet-pop_460ms_cubic-bezier(.2,.84,.18,1)]"
            src={notice.action?.src || catCompanion}
            alt={notice.action?.label || "提醒小猫"}
            draggable="false"
          />
        </div>
      </div>
    </div>
  );
}

function CatPose({ action }) {
  return (
    <div className="overflow-hidden rounded-[1rem] border border-white/80 bg-white/52 p-1 shadow-[0_10px_24px_rgba(148,163,184,0.08)] backdrop-blur-xl">
      <div className={`aspect-square overflow-hidden rounded-[0.85rem] bg-gradient-to-br ${action.tint}`}>
        {action.src ? (
          <img className="size-full object-contain p-2 drop-shadow-[0_10px_18px_rgba(15,23,42,0.14)]" src={action.src} alt={action.label} />
        ) : (
          <div className="grid size-full place-items-center p-2 text-center text-[8px] leading-tight text-slate-400">
            <span>
              <Sparkles className="mx-auto mb-1" size={16} />
              等待本地模型生成
            </span>
          </div>
        )}
      </div>
      <span className="mt-1 block truncate text-center text-[8px] font-medium text-slate-500">{action.label}</span>
    </div>
  );
}

function IdentityViewCard({ view }) {
  return (
    <div className="overflow-hidden rounded-[1rem] border border-white/80 bg-white/52 p-1 shadow-[0_10px_24px_rgba(148,163,184,0.08)] backdrop-blur-xl">
      <div className="relative aspect-square overflow-hidden rounded-[0.85rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(241,245,249,0.88))]">
        {view.src ? (
          <img
            className="size-full object-contain p-2 drop-shadow-[0_10px_18px_rgba(15,23,42,0.14)]"
            src={view.src}
            alt={view.label}
          />
        ) : (
          <div className="grid size-full place-items-center p-2 text-center text-[8px] leading-tight text-slate-400">
            <span>
              <Sparkles className="mx-auto mb-1" size={15} />
              待生成
            </span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full border border-white/80 bg-white/78 px-2 py-0.5 text-[8px] font-medium text-slate-500 backdrop-blur-xl">
          {view.key?.toUpperCase?.() || view.label}
        </span>
      </div>
      <div className="px-1.5 pb-1.5 pt-1">
        <p className="truncate text-center text-[8px] font-medium text-slate-600">{view.label}</p>
        <p className="mt-0.5 line-clamp-2 text-center text-[7px] leading-tight text-slate-400">{view.note || view.summary || "基于参考图推断"}</p>
      </div>
    </div>
  );
}

async function generatePetAssets(sourcePool, onProgress, desktopApi) {
  const sources = Array.isArray(sourcePool) && sourcePool.length ? sourcePool.slice(0, 10) : [catCompanion];

  onProgress?.(0.04, "正在整理参考图", `共 ${sources.length} 张照片`);

  if (!desktopApi?.generatePetAssets) {
    return {
      status: "needs_configuration",
      message: "网页预览没有连接桌面端生成接口。请运行 macOS 桌面 App，或配置本地生成服务后再生成。",
    };
  }

  onProgress?.(0.16, "连接本地免费生成服务", "默认使用 ComfyUI 或自定义 PET_GENERATION_ENDPOINT_URL");

  const response = await desktopApi.generatePetAssets({
    photos: sources,
    viewSpecs: identityViewSpecs,
    actionSpecs: companionActions.map(({ label, sourceKey }) => ({ label, sourceKey })),
  });

  if (!response?.ok) {
    return {
      status: "needs_configuration",
      message: response?.message || "本地生成服务还没有准备好。",
      code: response?.code,
      plan: response?.plan,
    };
  }

  const views = normalizeGeneratedViews(response.views);
  const variants = normalizeGeneratedVariants(response.variants);

  if (views.length < 5 || variants.length < 6 || views.some((view) => !view.src) || variants.some((variant) => !variant.src)) {
    return {
      status: "needs_configuration",
      message: "生成服务已响应，但输出不完整：需要 5 个五视图和 6 个动作。",
      plan: response.plan,
    };
  }

  onProgress?.(0.72, "已生成五视图", "正在整理六个动作和透明图");
  onProgress?.(1, "分析完成", `${sources.length} 张参考图 · ${variants.length} 个动作`);

  return {
    profile: {
      references: sources.length,
      generator: response.profile?.generator || response.provider || "本地免费模型",
      ...(response.profile || {}),
      views,
    },
    variants,
    primarySticker: response.primarySticker || views[0]?.src || variants[0]?.src,
  };
}

function normalizeGeneratedViews(views) {
  const source = Array.isArray(views) ? views : [];
  return identityViewSpecs.map((spec, index) => ({
    ...spec,
    ...(source[index] || {}),
    key: source[index]?.key || spec.key,
    label: source[index]?.label || spec.label,
    src: source[index]?.src || source[index]?.transparentPng || source[index]?.url || null,
  }));
}

function normalizeGeneratedVariants(variants) {
  const source = Array.isArray(variants) ? variants : [];
  return companionActions.map((action, index) => ({
    ...action,
    ...(source[index] || {}),
    label: source[index]?.label || action.label,
    src: source[index]?.src || source[index]?.transparentPng || source[index]?.url || null,
  }));
}

async function buildPetSticker(source) {
  const image = await loadImage(source);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) return source;

  sourceCtx.drawImage(image, 0, 0);
  const pixels = sourceCtx.getImageData(0, 0, width, height);
  const data = pixels.data;

  const corners = sampleCornerColors(data, width, height);
  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return source;

  const out = outCtx.createImageData(width, height);
  const alpha = out.data;

  const bgBox = getPetForegroundBox(width, height);

  for (let y = 0; y < height; y += 1) {
    const yT = height > 1 ? y / (height - 1) : 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const xT = width > 1 ? x / (width - 1) : 0;
      const bg = bilerpColor(corners, xT, yT);
      const dr = data[i] - bg[0];
      const dg = data[i + 1] - bg[1];
      const db = data[i + 2] - bg[2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      let fg = smoothstep(18, 76, dist);

      if (source === catCompanion) {
        const inBox = x >= bgBox.left && x <= bgBox.right && y >= bgBox.top && y <= bgBox.bottom;
        fg *= inBox ? 1 : 0;
      }

      const edgeFade = Math.min(
        smoothstep(0, 36, x),
        smoothstep(0, 36, y),
        smoothstep(0, 36, width - 1 - x),
        smoothstep(0, 36, height - 1 - y),
      );

      const finalAlpha = Math.max(0, Math.min(1, fg * 0.92)) * 255;
      alpha[i] = data[i];
      alpha[i + 1] = data[i + 1];
      alpha[i + 2] = data[i + 2];
      alpha[i + 3] = Math.round(finalAlpha * Math.max(0.72, edgeFade));
    }
  }

  outCtx.putImageData(out, 0, 0);

  if (source === catCompanion) {
    outCtx.save();
    outCtx.globalCompositeOperation = "destination-out";
    outCtx.fillStyle = "rgba(0,0,0,1)";
    outCtx.beginPath();
    outCtx.roundRect(width * 0.73, height * 0.66, width * 0.2, height * 0.22, 24);
    outCtx.fill();
    outCtx.restore();
  }

  const bounds = findAlphaBounds(outCtx.getImageData(0, 0, width, height).data, width, height);
  const finalCanvas = document.createElement("canvas");
  const pad = 42;
  finalCanvas.width = Math.max(1, Math.min(width, bounds.width + pad * 2));
  finalCanvas.height = Math.max(1, Math.min(height, bounds.height + pad * 2));
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) return source;

  finalCtx.clearRect(0, 0, width, height);
  finalCtx.drawImage(
    outCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    pad,
    pad,
    finalCanvas.width - pad * 2,
    finalCanvas.height - pad * 2,
  );
  return finalCanvas.toDataURL("image/png");
}

async function buildCompanionVariantsFromAtlas(atlas, profile, views, onProgress) {
  const sourceList = Array.isArray(atlas) && atlas.length ? atlas : [{ sticker: catCompanion, metrics: null }];
  const variants = [];
  const viewMap = new Map((views || []).map((view) => [view.key, view]));

  for (let index = 0; index < companionActions.length; index += 1) {
    const action = companionActions[index];
    const fallbackView = Array.isArray(views) && views.length ? views[index % views.length] : null;
    const selectedView = viewMap.get(action.sourceKey) || fallbackView || null;
    const sourceIndex = selectedView?.sourceIndex ?? chooseAtlasSourceIndex(sourceList, action.sourceKey);
    const source = sourceList[sourceIndex] || sourceList[0];
    const image = await loadImage(source.sticker || catCompanion);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const canvas = document.createElement("canvas");
    canvas.width = petCutoutSize;
    canvas.height = petCutoutSize;
    const ctx = canvas.getContext("2d");

    if (!ctx) continue;

    const metrics = source.metrics || {};
    const dw = 500 * action.zoom;
    const dh = height / width * dw;
    const skew = action.skew || 0;
    const offsetX = ((metrics.centroidX ?? 0.5) - 0.5) * 180 + (index - 2.5) * 8;
    const offsetY = ((metrics.centroidY ?? 0.55) - 0.55) * 110 + (action.sourceKey === "stretch" ? -10 : 0);
    const scaleBoost = 1 + Math.min(0.08, Math.max(-0.04, ((metrics.coverage ?? 0.12) - 0.12) * 0.6));

    ctx.save();
    ctx.clearRect(0, 0, petCutoutSize, petCutoutSize);
    ctx.translate(petCutoutSize / 2 + offsetX, petCutoutSize / 2 + offsetY);
    ctx.transform(action.mirror ? -1 : 1, 0, skew, 1, 0, 0);
    ctx.rotate((action.rotate * Math.PI) / 180);
    ctx.scale(scaleBoost, scaleBoost);
    ctx.filter = `saturate(${100 + Math.round((metrics.brightness ?? 0.5) * 10)}%) contrast(${100 + Math.round((metrics.coverage ?? 0.12) * 40)}%)`;
    ctx.shadowColor = "rgba(15,23,42,0.12)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    variants.push({
      label: action.label,
      src: canvas.toDataURL("image/png"),
      viewKey: action.sourceKey,
    });

    onProgress?.(0.66 + (index / companionActions.length) * 0.26, `生成第 ${index + 1}/6 个动作`, action.label);
  }

  return variants;
}

function buildPetIdentityProfileFromAtlas(atlas) {
  const sourceList = Array.isArray(atlas) ? atlas : [];
  const fallback = {
    references: sourceList.length || 1,
    dominantColor: "#c49a6c",
    bodyType: "透明底",
    poseEnergy: "轻松",
    faceBalance: "居中",
    coverage: 0,
  };

  if (!sourceList.length) {
    return fallback;
  }

  const summary = sourceList.reduce(
    (acc, entry) => {
      const metrics = entry.metrics || {};
      acc.color[0] += metrics.color?.[0] ?? 196;
      acc.color[1] += metrics.color?.[1] ?? 154;
      acc.color[2] += metrics.color?.[2] ?? 108;
      acc.aspect += metrics.aspect ?? 1;
      acc.coverage += metrics.coverage ?? 0;
      acc.centroidX += metrics.centroidX ?? 0.5;
      acc.centroidY += metrics.centroidY ?? 0.55;
      acc.brightness += metrics.brightness ?? 0.5;
      return acc;
    },
    {
      color: [0, 0, 0],
      aspect: 0,
      coverage: 0,
      centroidX: 0,
      centroidY: 0,
      brightness: 0,
    },
  );

  const count = sourceList.length;
  const color = summary.color.map((value) => Math.round(value / count));
  const aspect = summary.aspect / count;
  const coverage = summary.coverage / count;
  const centroidX = summary.centroidX / count;
  const centroidY = summary.centroidY / count;
  const brightness = summary.brightness / count;

  return {
    references: count,
    dominantColor: rgbToHex(color),
    bodyType: aspect < 0.82 ? "偏修长" : aspect > 1.08 ? "偏圆润" : "比例均衡",
    poseEnergy: coverage > 0.18 ? "动作更活泼" : coverage < 0.08 ? "姿态更安静" : "状态均衡",
    faceBalance: centroidX < 0.45 ? "更偏左" : centroidX > 0.55 ? "更偏右" : "居中",
    eyeLevel: centroidY < 0.5 ? "抬头较多" : centroidY > 0.62 ? "低头较多" : "眼神平稳",
    brightness: brightness,
  };
}

function buildIdentityViews(atlas, profile) {
  const sourceList = Array.isArray(atlas) && atlas.length ? atlas : [{ sticker: catCompanion, metrics: null, index: 0 }];

  return identityViewSpecs.map((spec, specIndex) => {
    const sourceIndex = chooseAtlasSourceIndex(sourceList, spec.key, specIndex);
    const source = sourceList[sourceIndex] || sourceList[0];
    return {
      ...spec,
      sourceIndex,
      src: source.sticker || catCompanion,
      note: spec.note,
      summary: spec.summary,
      accent: source.metrics?.color ? rgbToHex(source.metrics.color) : profile?.dominantColor || "#c49a6c",
    };
  });
}

function chooseAtlasSourceIndex(atlas, key, bias = 0) {
  const sourceList = Array.isArray(atlas) && atlas.length ? atlas : [{ metrics: null }];
  let bestIndex = 0;
  let bestScore = -Infinity;

  sourceList.forEach((entry, index) => {
    const score = scoreAtlasEntry(entry, key, index, bias);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function scoreAtlasEntry(entry, key, index, bias = 0) {
  const metrics = entry.metrics || {};
  const centroidX = metrics.centroidX ?? 0.5;
  const centroidY = metrics.centroidY ?? 0.55;
  const aspect = metrics.aspect ?? 1;
  const coverage = metrics.coverage ?? 0.12;
  const brightness = metrics.brightness ?? 0.5;
  const centerScore = 1 - Math.abs(centroidX - 0.5) * 2;
  const verticalScore = 1 - Math.abs(centroidY - 0.56) * 2;
  const balanceScore = 1 - Math.abs(aspect - 1);

  let score = centerScore * 2 + verticalScore + balanceScore + coverage + brightness * 0.2 - Math.abs(index - bias) * 0.03;

  if (key === "left") {
    score += (1 - centroidX) * 2;
  } else if (key === "right") {
    score += centroidX * 2;
  } else if (key === "calm") {
    score += verticalScore * 1.4 + (1 - Math.abs(aspect - 1.02)) * 0.9 + coverage;
  } else if (key === "stretch") {
    score += aspect * 0.9 + coverage * 0.7 + brightness * 0.3;
  } else {
    score += centerScore + verticalScore;
  }

  return score;
}

async function measurePetSticker(sticker) {
  const image = await loadImage(sticker);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      color: [196, 154, 108],
      aspect: 1,
      coverage: 0.12,
      centroidX: 0.5,
      centroidY: 0.55,
      brightness: 0.5,
    };
  }

  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let sumX = 0;
  let sumY = 0;
  let brightness = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha > 24) {
        const weight = alpha / 255;
        r += data[i] * weight;
        g += data[i + 1] * weight;
        b += data[i + 2] * weight;
        count += weight;
        sumX += x * weight;
        sumY += y * weight;
        brightness += (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) * weight;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!count) {
    return {
      color: [196, 154, 108],
      aspect: 1,
      coverage: 0.12,
      centroidX: 0.5,
      centroidY: 0.55,
      brightness: 0.5,
    };
  }

  const boxWidth = Math.max(1, maxX - minX + 1);
  const boxHeight = Math.max(1, maxY - minY + 1);
  const totalPixels = Math.max(1, width * height);

  return {
    color: [Math.round(r / count), Math.round(g / count), Math.round(b / count)],
    aspect: boxWidth / boxHeight,
    coverage: count / totalPixels,
    centroidX: sumX / (count * width),
    centroidY: sumY / (count * height),
    brightness: brightness / (count * 255),
  };
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function sampleCornerColors(data, width, height) {
  const samples = [
    sampleRegion(data, width, height, 0, 0, 0.08, 0.08),
    sampleRegion(data, width, height, 0.92, 0, 1, 0.08),
    sampleRegion(data, width, height, 0, 0.92, 0.08, 1),
    sampleRegion(data, width, height, 0.92, 0.92, 1, 1),
  ];
  return samples;
}

function sampleRegion(data, width, height, leftRatio, topRatio, rightRatio, bottomRatio) {
  const left = Math.floor(width * leftRatio);
  const top = Math.floor(height * topRatio);
  const right = Math.max(left + 1, Math.floor(width * rightRatio));
  const bottom = Math.max(top + 1, Math.floor(height * bottomRatio));
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
  }

  return count ? [r / count, g / count, b / count] : [255, 255, 255];
}

function bilerpColor(corners, x, y) {
  const [tl, tr, bl, br] = corners;
  const top = lerpColor(tl, tr, x);
  const bottom = lerpColor(bl, br, x);
  return lerpColor(top, bottom, y);
}

function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function getPetForegroundBox(width, height) {
  return {
    left: Math.floor(width * 0.12),
    top: Math.floor(height * 0.05),
    right: Math.floor(width * 0.82),
    bottom: Math.floor(height * 0.97),
  };
}

function findAlphaBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return { x: 0, y: 0, width, height };
  }

  return {
    x: Math.max(0, minX),
    y: Math.max(0, minY),
    width: Math.max(1, maxX - minX + 1),
    height: Math.max(1, maxY - minY + 1),
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

const rootContainer = document.getElementById("root");
if (!globalThis.__waterReminderRoot) {
  globalThis.__waterReminderRoot = createRoot(rootContainer);
}
globalThis.__waterReminderRoot.render(<Root />);
