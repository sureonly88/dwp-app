"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

interface Kegiatan {
  id: number;
  judul: string;
  tanggal: string;
  lokasi: string | null;
  kategori: string;
  status: "Mendatang" | "Berlangsung" | "Selesai" | "Dibatalkan";
  event_code: string;
}

interface DoorprizeSetup {
  jumlah_hadiah: number;
}

interface Winner {
  id: number;
  urutan: number;
  peserta_tipe: "anggota" | "tamu";
  nama: string;
  nip: string | null;
  jabatan: string | null;
  unit_kerja: string | null;
  instansi?: string | null;
  foto: string | null;
  waktu: string;
}

interface DrawWinner {
  id: number;
  urutan: number;
  nama: string;
  pesertaTipe: "anggota" | "tamu";
  unit: string | null;
  jabatan: string | null;
  foto: string | null;
}

type SpinState = "idle" | "running" | "stopping";

function formatTanggal(s: string) {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function readDoorprizePageStateFromUrl() {
  if (typeof window === "undefined") {
    return { selectedId: null as number | null, undianOpen: false };
  }

  const params = new URLSearchParams(window.location.search);
  const kegiatanParam = params.get("kegiatan");
  const parsedSelectedId = kegiatanParam ? Number(kegiatanParam) : Number.NaN;
  const selectedId = Number.isInteger(parsedSelectedId) && parsedSelectedId > 0 ? parsedSelectedId : null;

  return {
    selectedId,
    undianOpen: selectedId !== null && params.get("view") === "undian",
  };
}

function replaceDoorprizePageStateInUrl(selectedId: number | null, undianOpen: boolean) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  if (selectedId !== null) {
    params.set("kegiatan", String(selectedId));
  } else {
    params.delete("kegiatan");
  }

  if (selectedId !== null && undianOpen) {
    params.set("view", "undian");
  } else {
    params.delete("view");
  }

  const nextQuery = params.toString();
  const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
  window.history.replaceState(window.history.state, "", nextUrl);
}

const CONFETTI_COLORS = [
  "#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#a3e635", "#e879f9", "#fbbf24", "#34d399",
];
const CONFETTI_PIECES = Array.from({ length: 200 }, (_, i) => {
  // Full 360° burst from center
  const angleDeg = (i / 200) * 360;
  const angleRad = angleDeg * (Math.PI / 180);
  const r = 160 + (i * 13) % 640;
  return {
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    tx: `${Math.round(Math.sin(angleRad) * r)}px`,
    ty: `${Math.round(-Math.cos(angleRad) * r)}px`,
    rotate: `${(i * 43) % 720}deg`,
    width: `${5 + (i * 3) % 13}px`,
    height: `${12 + (i * 7) % 30}px`,
    duration: `${(0.9 + (i * 0.012) % 1.4).toFixed(2)}s`,
    delay: `${((i * 0.005) % 0.6).toFixed(2)}s`,
  };
});

export default function DoorprizePage() {
  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [kegiatanInfo, setKegiatanInfo] = useState<Kegiatan | null>(null);
  const [setup, setSetup] = useState<DoorprizeSetup | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(false);
  const [hadirCount, setHadirCount] = useState<number | null>(null);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);

  // Setup modal
  const [setupOpen, setSetupOpen] = useState(false);
  const [draftJumlah, setDraftJumlah] = useState("1");
  const [savingSetup, setSavingSetup] = useState(false);

  // Undian fullscreen modal
  const [undianOpen, setUndianOpen] = useState(false);
  const [spinState, setSpinState] = useState<SpinState>("idle");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<string[]>([]);
  const [lastWinners, setLastWinners] = useState<DrawWinner[]>([]);
  const [rollNames, setRollNames] = useState<string[]>([]);
  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rollIdxRef = useRef(0);
  const slowingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastPlayedWinnerKeyRef = useRef("");
  const selectedIdRef = useRef<number | null>(null);
  const undianOpenRef = useRef(false);
  const [celebrating, setCelebrating] = useState(false);
  const [undiError, setUndiError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetDoorprizeState = useCallback(() => {
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }
    slowingRef.current = false;
    lastPlayedWinnerKeyRef.current = "";
    setSpinState("idle");
    setWinners([]);
    setSetup(null);
    setKegiatanInfo(null);
    setHadirCount(null);
    setEligibleCount(null);
    setRollNames([]);
    setUndiError(null);
    setLastWinners([]);
    setDisplayName(null);
    setDisplayNames([]);
    setCelebrating(false);
  }, []);

  const loadKegiatan = useCallback(async () => {
    try {
      const res = await fetch(`/api/kegiatan?limit=100`);
      const json = await res.json();
      setKegiatanList(json.data ?? []);
    } catch {
      showToast("Gagal memuat daftar kegiatan", "error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Memuat data awal halaman dari API.
    loadKegiatan();
  }, [loadKegiatan]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    undianOpenRef.current = undianOpen;
  }, [undianOpen]);

  useEffect(() => {
    const syncStateFromUrl = () => {
      const nextState = readDoorprizePageStateFromUrl();

      if (selectedIdRef.current !== nextState.selectedId) {
        resetDoorprizeState();
        setSelectedId(nextState.selectedId);
      }

      if (undianOpenRef.current !== nextState.undianOpen) {
        setUndianOpen(nextState.undianOpen);
      }
    };

    syncStateFromUrl();
    window.addEventListener("popstate", syncStateFromUrl);
    return () => window.removeEventListener("popstate", syncStateFromUrl);
  }, [resetDoorprizeState]);

  const loadDetail = useCallback(async (kegiatanId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doorprize/${kegiatanId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setKegiatanInfo(json.kegiatan);
      setSetup(json.setup ?? null);
      setWinners(json.winners ?? []);
      setHadirCount(json.hadir_count ?? null);
      setEligibleCount(json.eligible_count ?? null);
      setRollNames((json.roll_names ?? []).filter((nama: string) => typeof nama === "string" && nama.trim().length > 0));
    } catch {
      showToast("Gagal memuat doorprize", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Memuat detail saat kegiatan dipilih.
    if (selectedId !== null) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    return () => { if (rollIntervalRef.current) clearInterval(rollIntervalRef.current); };
  }, []);

  // Setup modal
  const openSetup = () => {
    setDraftJumlah(setup ? String(setup.jumlah_hadiah) : "1");
    setSetupOpen(true);
  };

  const handleSaveSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const jumlah = Number(draftJumlah);
    if (!Number.isInteger(jumlah) || jumlah < 1) {
      showToast("Jumlah hadiah tidak valid", "error");
      return;
    }
    setSavingSetup(true);
    try {
      const res = await fetch(`/api/doorprize/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jumlah_hadiah: jumlah }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSetup({ jumlah_hadiah: json.jumlah_hadiah });
      setSetupOpen(false);
      showToast("Setup doorprize disimpan");
    } catch (err) {
      showToast((err as Error).message ?? "Gagal menyimpan", "error");
    } finally {
      setSavingSetup(false);
    }
  };

  // Undian
  const openUndian = async () => {
    if (selectedId !== null) {
      await loadDetail(selectedId);
    }
    lastPlayedWinnerKeyRef.current = "";
    setDisplayName(null);
    setDisplayNames([]);
    setLastWinners([]);
    setSpinState("idle");
    setUndiError(null);
    setUndianOpen(true);
    replaceDoorprizePageStateInUrl(selectedId, true);
  };

  const closeUndian = () => {
    if (spinState !== "idle") return;
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    slowingRef.current = false;
    lastPlayedWinnerKeyRef.current = "";
    setDisplayName(null);
    setDisplayNames([]);
    setCelebrating(false);
    setUndianOpen(false);
    replaceDoorprizePageStateInUrl(selectedId, false);
  };

  // ---- audio ----
  const getAudioCtx = () => {
    if (typeof window === "undefined") return null;
    try {
      if (!audioCtxRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        audioCtxRef.current = new AC();
      }
      return audioCtxRef.current;
    } catch { return null; }
  };
  const primeAudioCtx = () => {
    const ctx = getAudioCtx();
    if (!ctx) return null;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => null);
    }

    if (ctx.state !== "running") return ctx;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.00001, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.01);
    } catch {
      // ignore warm-up failures
    }

    return ctx;
  };
  // hi-hat: crisp noise tick — used during fast spin
  const playHihat = () => {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const bufSize = Math.floor(ctx.sampleRate * 0.07);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hpf = ctx.createBiquadFilter();
      hpf.type = "highpass";
      hpf.frequency.value = 4000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      src.connect(hpf); hpf.connect(gain); gain.connect(ctx.destination);
      src.start(); src.stop(ctx.currentTime + 0.07);
    } catch { /* ignore */ }
  };
  // snare: tonal body + band-pass noise — used when spin slows down
  const playSnare = () => {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.1);
      og.gain.setValueAtTime(0.6, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(og); og.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
      const bufSize = Math.floor(ctx.sampleRate * 0.12);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass"; bpf.frequency.value = 3500; bpf.Q.value = 0.5;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.55, ctx.currentTime);
      ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      src.connect(bpf); bpf.connect(ng); ng.connect(ctx.destination);
      src.start(); src.stop(ctx.currentTime + 0.12);
    } catch { /* ignore */ }
  };
  // victory: drum roll (10 snares) → kick + crash cymbal
  const playVictorySound = () => {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      // Drum roll accelerating into finale
      for (let i = 0; i < 10; i++) {
        const t = (i / 10) * 0.55;
        const osc = ctx.createOscillator();
        const og = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, ctx.currentTime + t);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + t + 0.08);
        og.gain.setValueAtTime(0.45 + i * 0.025, ctx.currentTime + t);
        og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.08);
        osc.connect(og); og.connect(ctx.destination);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.08);
        const bufSize = Math.floor(ctx.sampleRate * 0.08);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < bufSize; j++) d[j] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bpf = ctx.createBiquadFilter();
        bpf.type = "bandpass"; bpf.frequency.value = 3500; bpf.Q.value = 0.5;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.4 + i * 0.02, ctx.currentTime + t);
        ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.08);
        src.connect(bpf); bpf.connect(ng); ng.connect(ctx.destination);
        src.start(ctx.currentTime + t); src.stop(ctx.currentTime + t + 0.08);
      }
      // Kick drum
      const kT = 0.58;
      const kick = ctx.createOscillator();
      const kGain = ctx.createGain();
      kick.type = "sine";
      kick.frequency.setValueAtTime(150, ctx.currentTime + kT);
      kick.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + kT + 0.35);
      kGain.gain.setValueAtTime(0.9, ctx.currentTime + kT);
      kGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + kT + 0.4);
      kick.connect(kGain); kGain.connect(ctx.destination);
      kick.start(ctx.currentTime + kT); kick.stop(ctx.currentTime + kT + 0.4);
      // Crash cymbal
      const cT = 0.58;
      const cBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2.5), ctx.sampleRate);
      const cData = cBuf.getChannelData(0);
      for (let j = 0; j < cBuf.length; j++) cData[j] = Math.random() * 2 - 1;
      const cSrc = ctx.createBufferSource();
      cSrc.buffer = cBuf;
      const cHpf = ctx.createBiquadFilter();
      cHpf.type = "highpass"; cHpf.frequency.value = 5000;
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.8, ctx.currentTime + cT);
      cGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cT + 2.5);
      cSrc.connect(cHpf); cHpf.connect(cGain); cGain.connect(ctx.destination);
      cSrc.start(ctx.currentTime + cT); cSrc.stop(ctx.currentTime + cT + 2.5);
    } catch { /* ignore */ }
  };

  const handleStart = async () => {
    if (spinState !== "idle") return;
    if (isSlotFull) {
      setUndiError("Semua jatah hadiah untuk kegiatan ini sudah terpenuhi.");
      return;
    }
    if (eligibleCount === 0) {
      setUndiError(hadirCount === 0
        ? "Belum ada peserta hadir yang tercatat di kegiatan ini."
        : "Semua peserta yang hadir sudah mendapat doorprize di kegiatan ini.");
      return;
    }
    if (undiError) return;
    if (rollNames.length === 0) {
      setUndiError("Data nama peserta hadir belum tersedia untuk animasi pengundian.");
      return;
    }
    setUndiError(null);
    primeAudioCtx();
    setSpinState("running");
    setDisplayName(rollNames[rollIdxRef.current] ?? null);
    setDisplayNames([]);
    setLastWinners([]);
    rollIdxRef.current = 0;
    rollIntervalRef.current = setInterval(() => {
      rollIdxRef.current = (rollIdxRef.current + 1) % rollNames.length;
      setDisplayName(rollNames[rollIdxRef.current] ?? null);
      playHihat();
    }, 80);
  };

  const handleStop = async () => {
    if (spinState !== "running" || !selectedId) return;
    primeAudioCtx();
    setSpinState("stopping");

    slowingRef.current = true;
    let delay = 80;
    const slowDown = () => {
      if (!slowingRef.current) return;
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      delay = Math.min(delay * 1.35, 400);
      rollIntervalRef.current = setInterval(() => {
        rollIdxRef.current = (rollIdxRef.current + 1) % rollNames.length;
        setDisplayName(rollNames[rollIdxRef.current] ?? null);
        setDisplayNames([]);
        if (delay < 150) {
          playHihat();
        } else {
          playSnare();
        }
      }, delay);
      if (delay < 390) setTimeout(slowDown, delay * 3);
    };
    slowDown();

    try {
      const res = await fetch(`/api/doorprize/${selectedId}/undi`, { method: "POST" });
      const json = await res.json();

      await new Promise((r) => setTimeout(r, 1500));
      slowingRef.current = false;
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;

      if (!res.ok) {
        setSpinState("idle");
        setDisplayName(null);
        setDisplayNames([]);
        setUndiError(json.error ?? "Gagal mengundi");
        showToast(json.error ?? "Gagal mengundi", "error");
        return;
      }

      setUndiError(null);
      const drawnWinners: DrawWinner[] = Array.isArray(json.winners)
        ? json.winners.map((winner: {
            id: number;
            urutan: number;
            nama: string;
            peserta_tipe: "anggota" | "tamu";
            unit_kerja: string | null;
            jabatan: string | null;
            foto: string | null;
          }) => ({
            id: winner.id,
            urutan: winner.urutan,
            nama: winner.nama,
            pesertaTipe: winner.peserta_tipe,
            unit: winner.unit_kerja,
            jabatan: winner.jabatan,
            foto: winner.foto,
          }))
        : [];

      const winnerKey = drawnWinners.map((winner) => winner.id).join(",");
      if (winnerKey) {
        lastPlayedWinnerKeyRef.current = winnerKey;
      }
      setLastWinners(drawnWinners);
      setDisplayName(null);
      setDisplayNames([]);
      playVictorySound();
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 5500);
      showToast(`${drawnWinners.length} pemenang berhasil diundi`);
      loadDetail(selectedId);
    } catch {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
      setSpinState("idle");
      setDisplayName(null);
      setDisplayNames([]);
      showToast("Gagal mengundi", "error");
      return;
    }

    setSpinState("idle");
  };

  const handleBatalkanWinner = async (winnerId: number, nama: string) => {
    if (!selectedId) return;
    if (!confirm(`Batalkan kemenangan ${nama}?`)) return;
    try {
      const res = await fetch(`/api/doorprize/${selectedId}/winner/${winnerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("Pemenang dibatalkan");
      loadDetail(selectedId);
    } catch {
      showToast("Gagal membatalkan", "error");
    }
  };

  const isSlotFull = setup ? winners.length >= setup.jumlah_hadiah : false;
  const canStart = spinState === "idle" && !isSlotFull && hadirCount !== 0 && eligibleCount !== 0 && !undiError;
  const highlightedWinnerIds = new Set(lastWinners.map((winner) => winner.id));

  return (
    <AppLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg font-label-md text-label-md ${
          toast.type === "success"
            ? "bg-tertiary-container text-on-tertiary-container border border-tertiary-fixed-dim"
            : "bg-error-container text-error border border-error/30"
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      {/* Setup Modal */}
      {setupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSetupOpen(false)}>
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col gap-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined material-symbols-filled text-primary text-[28px]">settings</span>
              <h3 className="font-bold text-on-surface text-lg">Setup Doorprize</h3>
            </div>
            <form onSubmit={handleSaveSetup} className="flex flex-col gap-5">
              <div>
                <label className="text-label-sm text-on-surface-variant block mb-2">Jumlah Hadiah yang Dibagikan</label>
                <input
                  type="number"
                  min={1}
                  value={draftJumlah}
                  onChange={(e) => setDraftJumlah(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface h-11 text-center text-2xl font-bold"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setSetupOpen(false)} className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container text-[13px]">
                  Batal
                </button>
                <Button type="submit" icon="save" disabled={savingSetup}>
                  {savingSetup ? "Menyimpan..." : "Simpan Setup"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Undian Fullscreen Modal */}
      {undianOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface">
          <style>{`
            @keyframes winnerReveal {
              0%   { transform: scale(0.4) rotate(-4deg); opacity: 0; }
              65%  { transform: scale(1.06) rotate(1deg); opacity: 1; }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes shimmer {
              0%, 100% { opacity: 0.6; }
              50%       { opacity: 1; }
            }
            @keyframes burstUp {
              0%   { transform: translate(0, 0) rotate(0deg) scaleX(1); opacity: 1; }
              55%  { opacity: 1; }
              100% { transform: translate(var(--tx), calc(var(--ty) + 60px)) rotate(var(--rotate)) scaleX(-1); opacity: 0; }
            }
            .winner-reveal { animation: winnerReveal 0.65s cubic-bezier(0.175,0.885,0.32,1.275) both; }
            .shimmer-text  { animation: shimmer 1.2s ease-in-out infinite; }
          `}</style>

          {/* Full-screen confetti */}
          {celebrating && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
              {CONFETTI_PIECES.map((p) => (
                <div
                  key={p.id}
                  className="absolute rounded-sm"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: p.width,
                    height: p.height,
                    marginLeft: `calc(-${p.width} / 2)`,
                    marginTop: `calc(-${p.height} / 2)`,
                    backgroundColor: p.color,
                    "--tx": p.tx,
                    "--ty": p.ty,
                    "--rotate": p.rotate,
                    animation: `burstUp ${p.duration} ease-out ${p.delay} forwards`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          )}

          {/* Top bar */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-outline-variant bg-surface-container-lowest shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined material-symbols-filled text-primary text-[28px]">card_giftcard</span>
              <div>
                <h2 className="font-bold text-on-surface text-lg leading-tight">Pengundian Doorprize</h2>
                {kegiatanInfo && (
                  <p className="text-on-surface-variant text-[12px]">{kegiatanInfo.judul} · {formatTanggal(kegiatanInfo.tanggal)}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-widest">PESERTA HADIR</p>
                <p className={`font-bold text-[16px] ${hadirCount === 0 ? "text-error" : "text-tertiary"}`}>
                  {hadirCount ?? "–"} orang
                </p>
              </div>
              <div className="text-center">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-widest">PEMENANG</p>
                <p className="text-on-surface font-bold text-[16px]">{winners.length} / {setup?.jumlah_hadiah ?? "?"}</p>
              </div>
              {isSlotFull && (
                <div className="px-4 py-2 rounded-full bg-tertiary-container text-on-tertiary-container text-[12px] font-semibold">
                  ✅ Semua hadiah terisi
                </div>
              )}
              <button
                onClick={closeUndian}
                disabled={spinState !== "idle"}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[13px]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                Tutup
              </button>
            </div>
          </div>

          {/* Center spin area */}
          <div className="flex-1 flex flex-col items-center justify-center gap-10 px-8 relative overflow-hidden">

            {/* No eligible banner */}
            {spinState === "idle" && (isSlotFull || hadirCount === 0 || eligibleCount === 0 || undiError) && (
              <div className="w-full max-w-md px-6 py-4 rounded-2xl bg-error-container border border-error/30 flex items-start gap-3 text-error">
                <span className="material-symbols-outlined text-[22px] mt-0.5 shrink-0">group_off</span>
                <div>
                  <p className="font-bold text-[14px]">
                    {hadirCount === 0 ? "Tidak ada peserta yang hadir" : "Peserta undian sudah habis"}
                  </p>
                  <p className="text-[12px] mt-0.5 opacity-80">
                    {isSlotFull
                      ? "Semua jatah hadiah untuk kegiatan ini sudah terpenuhi."
                      : hadirCount === 0
                      ? "Belum ada peserta hadir yang tercatat di kegiatan ini."
                      : undiError ?? "Semua peserta yang hadir sudah mendapat doorprize di kegiatan ini."}
                  </p>
                </div>
              </div>
            )}

            {/* Status badge */}
            <div className={`px-8 py-2.5 rounded-full text-[15px] font-bold uppercase tracking-[0.2em] transition-all ${
              spinState === "running"
                ? "bg-tertiary text-on-tertiary"
                : spinState === "stopping"
                ? "bg-secondary text-on-secondary"
                : lastWinners.length > 0
                ? "bg-primary text-on-primary"
                : isSlotFull
                ? "bg-tertiary-container text-on-tertiary-container"
                : "bg-surface-container-high text-on-surface-variant"
            }`}>
              {spinState === "running" && "🎲 Sedang Bergulir..."}
              {spinState === "stopping" && "⏳ Melambat..."}
              {spinState === "idle" && lastWinners.length > 0 && "🎁 Pemenang!"}
              {spinState === "idle" && lastWinners.length === 0 && !isSlotFull && "Siap Mengundi"}
              {spinState === "idle" && lastWinners.length === 0 && isSlotFull && "✅ Semua Hadiah Terisi"}
            </div>

            {/* Name display */}
            <div className="text-center">
              <p className="text-on-surface-variant text-[11px] uppercase tracking-[0.3em] mb-4">
                {spinState === "idle" && lastWinners.length > 0 ? "PEMENANG DOORPRIZE" : "NAMA PESERTA"}
              </p>
              {spinState === "idle" && lastWinners.length > 0 ? (
                <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 winner-reveal">
                  {lastWinners.map((winner) => (
                    <div
                      key={winner.id}
                      className="rounded-2xl border border-primary/20 bg-primary-fixed px-5 py-6 shadow-lg"
                    >
                      <div className="mb-4 flex justify-center">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden border border-primary/20 bg-surface-container shadow-sm flex items-center justify-center">
                          {winner.foto ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={winner.foto} alt={`Foto ${winner.nama}`} className="w-full h-full object-cover" />
                            </>
                          ) : (
                            <span className="material-symbols-outlined text-primary/50 text-[42px]">account_circle</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-on-primary-fixed-variant/70 mb-3">
                        Hadiah ke-{winner.urutan}
                      </p>
                      <h2 className="text-2xl font-bold text-primary uppercase leading-tight break-words">
                        {winner.nama}
                      </h2>
                      <p className="mt-3 text-[13px] text-on-primary-fixed-variant shimmer-text">
                        {winner.pesertaTipe === "tamu" ? "Tamu Hadir" : "Anggota Hadir"}
                        {winner.unit ? ` · ${winner.unit}` : ""}
                        {winner.jabatan ? ` · ${winner.jabatan}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                spinState === "running" || spinState === "stopping" ? (
                  <h1 className="text-6xl font-bold leading-tight uppercase text-on-surface-variant/50 transition-all duration-100">
                    {displayName ?? "— — —"}
                  </h1>
                ) : displayNames.length > 0 ? (
                  <div className="w-full max-w-6xl grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                    {displayNames.map((name, index) => (
                      <div
                        key={`${name}-${index}`}
                        className={`rounded-2xl border px-5 py-6 shadow-sm transition-all ${
                          spinState !== "idle"
                            ? "border-outline-variant bg-surface-container-high text-on-surface"
                            : "border-outline-variant/50 bg-surface-container-low text-on-surface-variant"
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-[0.25em] opacity-70 mb-2">
                          Peserta {index + 1}
                        </p>
                        <h2 className="text-2xl font-bold uppercase leading-tight break-words">
                          {name}
                        </h2>
                      </div>
                    ))}
                  </div>
                ) : (
                  <h1
                    className={`font-bold leading-tight uppercase ${
                      spinState !== "idle"
                        ? "text-6xl text-on-surface-variant/50 transition-all duration-100"
                        : "text-6xl text-on-surface-variant/20"
                    }`}
                  >
                    — — —
                  </h1>
                )
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-6">
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="flex items-center gap-3 px-12 py-5 rounded-2xl font-bold text-[16px] bg-tertiary text-on-tertiary hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined material-symbols-filled text-[30px]">play_circle</span>
                MULAI
              </button>
              <button
                onClick={handleStop}
                disabled={spinState !== "running"}
                className="flex items-center gap-3 px-12 py-5 rounded-2xl font-bold text-[16px] bg-error text-on-error hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined material-symbols-filled text-[30px]">stop_circle</span>
                STOP
              </button>
            </div>

            <p className="text-on-surface-variant text-[12px] text-center">
              {isSlotFull
                ? "Semua hadiah sudah memiliki pemenang."
                : lastWinners.length > 0
                ? "Klik MULAI untuk mengundi putaran berikutnya dengan maksimal 10 pemenang lagi."
                : "Klik MULAI untuk memutar nama peserta, lalu klik STOP untuk memilih maksimal 10 pemenang sekaligus."}
            </p>
          </div>

          {/* Bottom: winners strip */}
          {winners.length > 0 && (
            <div className="px-8 pb-6">
              <div className="border border-outline-variant rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-surface-container border-b border-outline-variant flex items-center gap-2">
                  <span className="material-symbols-outlined material-symbols-filled text-secondary text-[16px]">emoji_events</span>
                  <span className="text-on-surface-variant text-[12px] font-semibold uppercase tracking-widest">Pemenang Doorprize</span>
                  <span className="ml-auto text-on-surface-variant text-[11px]">{winners.length} pemenang</span>
                </div>
                <div className="flex gap-3 px-5 py-3 overflow-x-auto bg-surface-container-lowest">
                  {winners.map((w) => (
                    <div
                      key={w.id}
                      className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
                        highlightedWinnerIds.has(w.id)
                          ? "bg-primary-fixed border-primary/40"
                          : "bg-surface-container border-outline-variant"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
                        {w.foto ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={w.foto} alt={`Foto ${w.nama}`} className="w-full h-full object-cover" />
                          </>
                        ) : (
                          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">person</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-on-surface-variant text-[10px] uppercase">Hadiah ke-{w.urutan}</span>
                        <span className="text-on-surface text-[13px] font-medium whitespace-nowrap uppercase">{w.nama}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-8">
        {/* Page Header */}
        <div>
          <nav className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
            <span>Beranda</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-semibold">Doorprize</span>
          </nav>
          <h2 className="font-h1 text-h1 text-primary">Doorprize Kegiatan</h2>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mt-2">
            Undi pemenang doorprize dari peserta kegiatan secara transparan dan menyenangkan.
          </p>
        </div>

        {/* Kegiatan Selector */}
        <Card className="p-5">
          <div className="flex-1">
            <label className="text-label-sm text-on-surface-variant block mb-1">Pilih Kegiatan</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">event</span>
              <select
                value={selectedId ?? ""}
                onChange={(e) => {
                  const nextSelectedId = e.target.value ? Number(e.target.value) : null;
                  resetDoorprizeState();
                  setUndianOpen(false);
                  setSelectedId(nextSelectedId);
                  replaceDoorprizePageStateInUrl(nextSelectedId, false);
                }}
                className="w-full appearance-none border border-outline-variant rounded-lg pl-10 pr-10 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface h-11"
              >
                <option value="">— Pilih kegiatan untuk doorprize —</option>
                {kegiatanList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {formatTanggal(k.tanggal)} · {k.judul}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">expand_more</span>
            </div>
          </div>
        </Card>

        {!selectedId && (
          <Card className="p-16 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[72px] block mb-4 opacity-20">card_giftcard</span>
            <p className="text-body-md font-semibold">Pilih kegiatan terlebih dahulu</p>
            <p className="text-body-sm mt-1">Gunakan dropdown di atas untuk memilih kegiatan doorprize.</p>
          </Card>
        )}

        {selectedId && (
          <>
            {/* Info chips + actions */}
            {kegiatanInfo && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container border border-outline-variant text-body-sm text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[16px]">event</span>
                  {kegiatanInfo.judul}
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container border border-outline-variant text-body-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                  {formatTanggal(kegiatanInfo.tanggal)}
                </div>
                {kegiatanInfo.lokasi && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container border border-outline-variant text-body-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                    {kegiatanInfo.lokasi}
                  </div>
                )}
                {hadirCount !== null && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-tertiary-container border border-tertiary/20 text-body-sm text-on-tertiary-container">
                    <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                    {hadirCount} peserta hadir
                  </div>
                )}
                {setup && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-fixed border border-primary/20 text-body-sm text-on-primary-fixed-variant">
                    <span className="material-symbols-outlined text-[16px]">redeem</span>
                    {winners.length} / {setup.jumlah_hadiah} hadiah diundi
                  </div>
                )}
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={openSetup}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors text-[13px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                    {setup ? "Ubah Setup" : "Setup Hadiah"}
                  </button>
                </div>
              </div>
            )}

            {/* Main action area */}
            {loading ? (
              <Card className="p-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[40px] opacity-30 block mb-2">hourglass_empty</span>
                <p className="text-body-sm">Memuat...</p>
              </Card>
            ) : !setup ? (
              <Card className="p-16 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[56px] block mb-4 opacity-30">tune</span>
                <p className="text-body-md font-semibold">Setup doorprize belum dikonfigurasi</p>
                <p className="text-body-sm mt-1 mb-6">Tentukan jumlah hadiah yang akan dibagikan sebelum memulai pengundian.</p>
                <Button icon="settings" onClick={openSetup}>Setup Doorprize</Button>
              </Card>
            ) : (
              <Card className="p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined material-symbols-filled text-primary text-[36px]">card_giftcard</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface text-lg">Pengundian Doorprize</h3>
                      <p className="text-on-surface-variant text-[13px]">
                        {winners.length} dari {setup.jumlah_hadiah} hadiah sudah diundi
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isSlotFull ? (
                      <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-tertiary-container text-on-tertiary-container font-semibold text-[14px]">
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        Semua Hadiah Terisi
                      </div>
                    ) : (
                      <button
                        onClick={openUndian}
                        className="flex items-center gap-3 px-8 py-3.5 rounded-2xl font-bold text-[15px] bg-primary text-on-primary hover:opacity-90 active:scale-95 transition-all shadow-md"
                      >
                        <span className="material-symbols-outlined material-symbols-filled text-[24px]">play_circle</span>
                        Mulai Pengundian
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-on-surface-variant mb-1.5 uppercase tracking-widest">
                    <span>Progress Hadiah</span>
                    <span>{Math.round((winners.length / setup.jumlah_hadiah) * 100)}%</span>
                  </div>
                  <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: `${(winners.length / setup.jumlah_hadiah) * 100}%` }}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Winners table */}
            {winners.length > 0 && (
              <Card className="flex flex-col">
                <div className="p-6 border-b border-outline-variant flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined material-symbols-filled text-secondary text-[22px]">emoji_events</span>
                    <h4 className="font-h3 text-[20px] text-on-surface">Daftar Pemenang</h4>
                  </div>
                  <Badge label={`${winners.length} pemenang`} variant="info" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-body-sm">
                    <thead>
                      <tr className="bg-surface-container border-b border-outline-variant text-on-surface-variant text-[11px] uppercase tracking-widest">
                        <th className="px-5 py-3 text-center w-12">#</th>
                        <th className="px-5 py-3 text-center">Foto</th>
                        <th className="px-5 py-3 text-left">Nama</th>
                        <th className="px-5 py-3 text-left">Jenis</th>
                        <th className="px-5 py-3 text-left">NIP</th>
                        <th className="px-5 py-3 text-left">Jabatan</th>
                        <th className="px-5 py-3 text-left">Instansi / Unit Kerja</th>
                        <th className="px-5 py-3 text-center">Waktu</th>
                        <th className="px-3 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {winners.map((w) => (
                        <tr key={w.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-5 py-3.5 text-center">
                            <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-secondary-fixed text-secondary font-bold text-[13px]">
                              {w.urutan}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <div className="inline-flex w-12 h-12 rounded-xl overflow-hidden bg-surface-container-high border border-outline-variant items-center justify-center">
                              {w.foto ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={w.foto} alt={`Foto ${w.nama}`} className="w-full h-full object-cover" />
                                </>
                              ) : (
                                <span className="material-symbols-outlined text-on-surface-variant text-[24px]">person</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-on-surface uppercase whitespace-nowrap text-[15px]">{w.nama}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <Badge label={w.peserta_tipe === "tamu" ? "Tamu" : "Anggota"} variant={w.peserta_tipe === "tamu" ? "warning" : "info"} />
                          </td>
                          <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{w.nip || "-"}</td>
                          <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{w.jabatan || "-"}</td>
                          <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{w.unit_kerja || w.instansi || "-"}</td>
                          <td className="px-5 py-3.5 text-on-surface-variant text-center whitespace-nowrap text-[12px]">
                            {w.waktu ? new Date(w.waktu).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <button
                              onClick={() => handleBatalkanWinner(w.id, w.nama)}
                              className="p-1.5 rounded-lg text-error hover:bg-error-container/30 transition-colors"
                              title="Batalkan pemenang"
                            >
                              <span className="material-symbols-outlined text-[18px]">undo</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
