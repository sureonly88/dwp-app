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

interface ArisanSetup {
  nominal_per_orang: string | number;
  jumlah_pemenang: number;
  jumlah_per_undi: number;
}

interface ArisanWinner {
  id: number;
  anggota_id: number;
  urutan: number;
  waktu: string;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  foto: string | null;
}

interface AllWinner {
  id: number;
  urutan: number;
  waktu: string;
  anggota_id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  kegiatan_id: number;
  kegiatan_judul: string;
  kegiatan_tanggal: string;
  kegiatan_bulan: number;
  lokasi: string | null;
  nominal_per_orang: string | null;
}

interface AnggotaOption {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: "Aktif" | "Non-Aktif" | "Cuti";
}

interface BelumMenerimaArisan {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status_keanggotaan: string;
  no_hp: string | null;
  email: string | null;
}

interface BelumMenerimaSummary {
  tahun: number;
  bulan: number;
  awal: string;
  akhir: string;
  label: string;
  total_belum_menerima: number;
  total_anggota_eligible: number;
  total_sudah_menerima: number;
}

type SpinState = "idle" | "running" | "stopping";

function formatTanggal(s: string) {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
function formatBulan(month: number | string) {
  const monthNumber = Number(month);
  if (!monthNumber || monthNumber < 1 || monthNumber > 12) return "-";
  return new Date(2000, monthNumber - 1, 1).toLocaleDateString("id-ID", { month: "long" });
}
function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
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

const INPUT_CLS =
  "w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface h-11";
const SELECT_CLS =
  "w-full appearance-none border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface h-11";

const MONTH_OPTIONS = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

export default function ArisanPage() {
  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [setup, setSetup] = useState<ArisanSetup | null>(null);
  const [winners, setWinners] = useState<ArisanWinner[]>([]);
  const [kegiatanInfo, setKegiatanInfo] = useState<Kegiatan | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [hadirCount, setHadirCount] = useState<number | null>(null);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);

  // Spin state
  const [spinState, setSpinState] = useState<SpinState>("idle");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [lastWinners, setLastWinners] = useState<ArisanWinner[]>([]);
  const [rollNames, setRollNames] = useState<string[]>([]);
  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rollIdxRef = useRef(0);
  const slowingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Setup modal
  const [setupOpen, setSetupOpen] = useState(false);
  const [nominal, setNominal] = useState("0");
  const [jumlahPemenang, setJumlahPemenang] = useState("10");
  const [jumlahPerUndi, setJumlahPerUndi] = useState("10");
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Undian fullscreen modal
  const [undianOpen, setUndianOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [undiError, setUndiError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Page tabs
  const [pageTab, setPageTab] = useState<"per_kegiatan" | "manual" | "belum_menerima" | "riwayat">("per_kegiatan");
  const [allWinners, setAllWinners] = useState<AllWinner[]>([]);
  const [allWinnersYears, setAllWinnersYears] = useState<number[]>([]);
  const [allWinnersYear, setAllWinnersYear] = useState<string>(String(new Date().getFullYear()));
  const [allWinnersMonth, setAllWinnersMonth] = useState<string>("");
  const [allWinnersLoading, setAllWinnersLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [selectedWinnerIds, setSelectedWinnerIds] = useState<Set<number>>(() => new Set());
  const [cancellingSelected, setCancellingSelected] = useState(false);
  const [belumMenerimaRows, setBelumMenerimaRows] = useState<BelumMenerimaArisan[]>([]);
  const [belumMenerimaSummary, setBelumMenerimaSummary] = useState<BelumMenerimaSummary | null>(null);
  const [belumMenerimaYear, setBelumMenerimaYear] = useState<string>(String(new Date().getFullYear()));
  const [belumMenerimaMonth, setBelumMenerimaMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [belumMenerimaLoading, setBelumMenerimaLoading] = useState(false);
  const [downloadingBelumMenerimaExcel, setDownloadingBelumMenerimaExcel] = useState(false);
  const [downloadingBelumMenerimaPdf, setDownloadingBelumMenerimaPdf] = useState(false);

  // Manual input
  const [anggotaOptions, setAnggotaOptions] = useState<AnggotaOption[]>([]);
  const [manualKegiatanId, setManualKegiatanId] = useState("");
  const [manualAnggotaId, setManualAnggotaId] = useState("");
  const [manualSearch, setManualSearch] = useState("");
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [manualDuplicateChecking, setManualDuplicateChecking] = useState(false);
  const [manualDuplicateMessage, setManualDuplicateMessage] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // ---- data fetching ----
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

  const loadAnggotaOptions = useCallback(async (search = "") => {
    try {
      setManualSearchLoading(true);
      const params = new URLSearchParams({ status: "Aktif", limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/anggota?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAnggotaOptions(json.data ?? []);
    } catch {
      showToast("Gagal memuat daftar anggota", "error");
    } finally {
      setManualSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pageTab === "manual" && anggotaOptions.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Memuat opsi anggota saat tab manual dibuka.
      loadAnggotaOptions();
    }
  }, [pageTab, anggotaOptions.length, loadAnggotaOptions]);

  useEffect(() => {
    if (pageTab !== "manual") return;
    const timer = setTimeout(() => {
      loadAnggotaOptions(manualSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [pageTab, manualSearch, loadAnggotaOptions]);

  useEffect(() => {
    if (pageTab !== "manual" || !manualKegiatanId || !manualAnggotaId) {
      return;
    }

    const selectedKegiatan = kegiatanList.find((k) => k.id === Number(manualKegiatanId));
    const selectedYear = selectedKegiatan ? new Date(selectedKegiatan.tanggal).getFullYear() : null;
    if (!selectedYear || Number.isNaN(selectedYear)) {
      return;
    }

    let cancelled = false;
    const checkDuplicate = async () => {
      setManualDuplicateChecking(true);
      setManualDuplicateMessage(null);
      try {
        const res = await fetch(`/api/arisan/winners?tahun=${selectedYear}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        if (cancelled) return;

        const existing = (json.data ?? []).find((w: AllWinner) => w.anggota_id === Number(manualAnggotaId));
        if (existing) {
          setManualDuplicateMessage(
            `Anggota ini sudah menerima arisan pada tahun ${selectedYear} di kegiatan "${existing.kegiatan_judul}". Tidak dapat diinput ulang.`,
          );
        }
      } catch {
        if (!cancelled) setManualDuplicateMessage(null);
      } finally {
        if (!cancelled) setManualDuplicateChecking(false);
      }
    };

    checkDuplicate();
    return () => { cancelled = true; };
  }, [pageTab, manualKegiatanId, manualAnggotaId, kegiatanList]);

  const fetchAllWinners = useCallback(async () => {
    setAllWinnersLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (allWinnersYear) searchParams.set("tahun", allWinnersYear);
      if (allWinnersMonth) searchParams.set("bulan", allWinnersMonth);
      const params = searchParams.toString() ? `?${searchParams.toString()}` : "";
      const res = await fetch(`/api/arisan/winners${params}`);
      const json = await res.json();
      setAllWinners(json.data ?? []);
      setAllWinnersYears(json.years ?? []);
    } catch {
      showToast("Gagal memuat riwayat pemenang", "error");
    } finally {
      setAllWinnersLoading(false);
    }
  }, [allWinnersYear, allWinnersMonth]);

  useEffect(() => {
    if (pageTab === "riwayat") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Memuat ulang riwayat saat filter/tab berubah.
      fetchAllWinners();
    }
  }, [pageTab, fetchAllWinners]);

  const fetchBelumMenerima = useCallback(async () => {
    setBelumMenerimaLoading(true);
    try {
      const searchParams = new URLSearchParams();
      searchParams.set("tahun", belumMenerimaYear);
      searchParams.set("bulan", belumMenerimaMonth);
      const res = await fetch(`/api/arisan/belum-menerima?${searchParams.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setBelumMenerimaRows(json.data ?? []);
      setBelumMenerimaSummary(json.summary ?? null);
    } catch {
      showToast("Gagal memuat data anggota yang belum menerima arisan", "error");
    } finally {
      setBelumMenerimaLoading(false);
    }
  }, [belumMenerimaYear, belumMenerimaMonth]);

  useEffect(() => {
    if (pageTab === "belum_menerima") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Memuat laporan saat tab/filter berubah.
      fetchBelumMenerima();
    }
  }, [pageTab, fetchBelumMenerima]);

  const loadDetail = useCallback(async (kegiatanId: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/arisan/${kegiatanId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const nextWinners: ArisanWinner[] = json.winners ?? [];
      setKegiatanInfo(json.kegiatan);
      setSetup(json.setup ? { ...json.setup, jumlah_per_undi: Number(json.setup.jumlah_per_undi ?? 10) } : null);
      setWinners(nextWinners);
      setSelectedWinnerIds((current) => {
        const availableWinnerIds = new Set(nextWinners.map((winner) => winner.id));
        return new Set([...current].filter((winnerId) => availableWinnerIds.has(winnerId)));
      });
      setHadirCount(json.hadir_count ?? null);
      setEligibleCount(json.eligible_count ?? null);
      setNominal(json.setup ? String(Number(json.setup.nominal_per_orang)) : "0");
      setJumlahPemenang(json.setup ? String(json.setup.jumlah_pemenang) : "10");
      setJumlahPerUndi(json.setup ? String(json.setup.jumlah_per_undi ?? 10) : "10");
      setUndiError(null);
      // Nama anggota hadir di kegiatan ini — dipakai untuk animasi roll
      setRollNames((json.roll_names ?? []).filter((n: string) => typeof n === "string" && n.trim().length > 0));
    } catch {
      showToast("Gagal memuat detail arisan", "error");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset state undian saat kegiatan berubah.
      setDisplayName(null);
      setLastWinners([]);
      setSpinState("idle");
      setRollNames([]);
      setSelectedWinnerIds(new Set());
      loadDetail(selectedId);
    }
  }, [selectedId, loadDetail]);

  // ---- cleanup interval on unmount ----
  useEffect(() => {
    return () => { if (rollIntervalRef.current) clearInterval(rollIntervalRef.current); };
  }, []);

  // ---- setup modal save ----
  const handleSaveSetup = async () => {
    if (!selectedId) return;
    setSetupError(null);
    const totalPemenang = Number(jumlahPemenang);
    const pemenangPerUndi = Number(jumlahPerUndi);
    if (!Number.isInteger(totalPemenang) || totalPemenang < 1) {
      setSetupError("Jumlah pemenang kegiatan tidak valid");
      return;
    }
    if (!Number.isInteger(pemenangPerUndi) || pemenangPerUndi < 1) {
      setSetupError("Jumlah pemenang dalam 1 pengundian tidak valid");
      return;
    }
    setSavingSetup(true);
    try {
      const res = await fetch(`/api/arisan/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nominal_per_orang: Number(nominal),
          jumlah_pemenang: totalPemenang,
          jumlah_per_undi: pemenangPerUndi,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast("Setup arisan tersimpan");
      setSetupOpen(false);
      loadDetail(selectedId);
    } catch (e) {
      setSetupError((e as Error).message ?? "Gagal menyimpan setup");
    } finally {
      setSavingSetup(false);
    }
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
  // hi-hat: crisp high-freq noise burst — used during fast spin
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

  // ---- spin start ----
  const handleStart = async () => {
    if (spinState !== "idle" || !setup) return;
    if (isSlotFull) {
      setUndiError("Pengundian sudah habis. Semua jatah pemenang sudah terisi.");
      return;
    }
    if (eligibleCount === 0) {
      setUndiError(hadirCount === 0
        ? "Belum ada anggota yang melakukan presensi di kegiatan ini."
        : "Pengundian sudah habis. Semua peserta yang hadir sudah pernah mendapat arisan tahun ini.");
      return;
    }
    if (undiError) return;
    if (rollNames.length === 0) {
      setUndiError("Data nama anggota belum tersedia untuk animasi pengundian.");
      return;
    }
    setUndiError(null);
    const ac = getAudioCtx();
    if (ac) ac.resume().catch(() => {});
    setSpinState("running");
    setDisplayName(rollNames[rollIdxRef.current] ?? null);
    setLastWinners([]);
    rollIdxRef.current = 0;
    rollIntervalRef.current = setInterval(() => {
      rollIdxRef.current = (rollIdxRef.current + 1) % rollNames.length;
      setDisplayName(rollNames[rollIdxRef.current] ?? null);
      playHihat();
    }, 80);
  };

  // ---- spin stop ----
  const handleStop = async () => {
    if (spinState !== "running" || !selectedId) return;
    const ac = getAudioCtx();
    if (ac) ac.resume().catch(() => {});
    setSpinState("stopping");

    // Slow down gradually
    slowingRef.current = true;
    let delay = 80;
    const slowDown = () => {
      if (!slowingRef.current) return;
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      delay = Math.min(delay * 1.35, 400);
      rollIntervalRef.current = setInterval(() => {
        rollIdxRef.current = (rollIdxRef.current + 1) % rollNames.length;
        setDisplayName(rollNames[rollIdxRef.current] ?? null);
        if (delay < 150) {
          playHihat();
        } else {
          playSnare();
        }
      }, delay);
      if (delay < 390) setTimeout(slowDown, delay * 3);
    };
    slowDown();

    // Call API in background
    try {
      const res = await fetch(`/api/arisan/${selectedId}/undi`, { method: "POST" });
      const json = await res.json();

      // Wait minimum ~1.5s of slow-down visual then reveal
      await new Promise((r) => setTimeout(r, 1500));
      slowingRef.current = false;
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;

      if (!res.ok) {
        setSpinState("idle");
        setDisplayName(null);
        setUndiError(json.error ?? "Gagal mengundi");
        showToast(json.error ?? "Gagal mengundi", "error");
        return;
      }

      setUndiError(null);
      const drawnWinners: ArisanWinner[] = Array.isArray(json.winners) ? json.winners : [];
      setLastWinners(drawnWinners);
      setDisplayName(null);
      playVictorySound();
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 5500);
      showToast(`${drawnWinners.length} pemenang arisan berhasil diundi`);
      loadDetail(selectedId);
    } catch {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
      setSpinState("idle");
      setDisplayName(null);
      showToast("Gagal mengundi", "error");
      return;
    }

    setSpinState("idle");
  };

  // ---- cancel winner ----
  const handleHapusWinner = async (winnerId: number, nama: string) => {
    if (!selectedId) return;
    if (!confirm(`Batalkan pemenang ${nama}?`)) return;
    try {
      const res = await fetch(`/api/arisan/${selectedId}/winner/${winnerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Pemenang ${nama} dibatalkan`);
      setSelectedWinnerIds((current) => {
        const next = new Set(current);
        next.delete(winnerId);
        return next;
      });
      if (lastWinners.some((winner) => winner.id === winnerId)) {
        setLastWinners((current) => current.filter((winner) => winner.id !== winnerId));
        setDisplayName(null);
      }
      loadDetail(selectedId);
    } catch {
      showToast("Gagal membatalkan", "error");
    }
  };

  const toggleWinnerSelection = (winnerId: number) => {
    setSelectedWinnerIds((current) => {
      const next = new Set(current);
      if (next.has(winnerId)) {
        next.delete(winnerId);
      } else {
        next.add(winnerId);
      }
      return next;
    });
  };

  const toggleAllWinners = () => {
    setSelectedWinnerIds(allWinnersSelected ? new Set() : new Set(winners.map((winner) => winner.id)));
  };

  const handleBatalkanSelectedWinners = async () => {
    if (!selectedId || selectedWinnerIds.size === 0) return;

    const selectedIds = new Set(selectedWinnerIds);
    const selectedWinners = winners.filter((winner) => selectedIds.has(winner.id));
    if (selectedWinners.length === 0) return;
    if (!confirm(`Batalkan ${selectedWinners.length} pemenang terpilih?`)) return;

    setCancellingSelected(true);
    let deletedCount = 0;
    try {
      for (const winner of selectedWinners) {
        const res = await fetch(`/api/arisan/${selectedId}/winner/${winner.id}`, { method: "DELETE" });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? `Gagal membatalkan ${winner.nama}`);
        }
        deletedCount += 1;
      }

      showToast(`${selectedWinners.length} pemenang dibatalkan`);
      setSelectedWinnerIds(new Set());
      setLastWinners((current) => current.filter((winner) => !selectedIds.has(winner.id)));
      loadDetail(selectedId);
    } catch (e) {
      showToast((e as Error).message ?? "Gagal membatalkan pemenang terpilih", "error");
      if (deletedCount > 0) {
        setSelectedWinnerIds(new Set());
        setLastWinners((current) => current.filter((winner) => !selectedIds.has(winner.id)));
        loadDetail(selectedId);
      }
    } finally {
      setCancellingSelected(false);
    }
  };

  const handleResetArisan = async () => {
    if (!selectedId) return;
    if (!confirm("Hapus seluruh setup & pemenang arisan untuk kegiatan ini?")) return;
    try {
      const res = await fetch(`/api/arisan/${selectedId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("Arisan direset");
      setSetup(null);
      setWinners([]);
      setDisplayName(null);
      setLastWinners([]);
      setNominal("0");
      setJumlahPemenang("10");
      setJumlahPerUndi("10");
      setSelectedWinnerIds(new Set());
    } catch {
      showToast("Gagal mereset", "error");
    }
  };

  const handleManualSubmit = async () => {
    setManualError(null);
    if (!manualKegiatanId || !manualAnggotaId) {
      setManualError("Pilih kegiatan dan anggota terlebih dahulu.");
      return;
    }
    if (manualDuplicateMessage) {
      setManualError(manualDuplicateMessage);
      return;
    }

    setManualSaving(true);
    try {
      const res = await fetch(`/api/arisan/${manualKegiatanId}/winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anggota_id: Number(manualAnggotaId) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal mencatat penerima arisan");

      showToast(`Penerima arisan dicatat: ${json.winner.nama}`);
      setManualAnggotaId("");
      setManualSearch("");
      setManualSearchOpen(false);
      setManualDuplicateMessage(null);
      if (selectedId === Number(manualKegiatanId)) loadDetail(Number(manualKegiatanId));
      if (pageTab === "riwayat") fetchAllWinners();
    } catch (e) {
      setManualError((e as Error).message ?? "Gagal mencatat penerima arisan");
    } finally {
      setManualSaving(false);
    }
  };

  const handleDownloadWinnersPdf = async () => {
    if (!selectedId) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/arisan/${selectedId}/pdf`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Gagal mengunduh PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pemenang-arisan-${kegiatanInfo?.event_code ?? selectedId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast((e as Error).message ?? "Gagal mengunduh PDF", "error");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadBelumMenerima = async (format: "excel" | "pdf") => {
    const isExcel = format === "excel";
    if (isExcel) {
      setDownloadingBelumMenerimaExcel(true);
    } else {
      setDownloadingBelumMenerimaPdf(true);
    }

    try {
      const searchParams = new URLSearchParams({
        tahun: belumMenerimaYear,
        bulan: belumMenerimaMonth,
      });
      const endpoint = isExcel
        ? `/api/arisan/belum-menerima/export?${searchParams.toString()}`
        : `/api/arisan/belum-menerima/pdf?${searchParams.toString()}`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Gagal mengunduh laporan");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const period = `${belumMenerimaYear}-${String(belumMenerimaMonth).padStart(2, "0")}`;
      a.download = `anggota-belum-menerima-arisan-${period}.${isExcel ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast((e as Error).message ?? "Gagal mengunduh laporan", "error");
    } finally {
      if (isExcel) {
        setDownloadingBelumMenerimaExcel(false);
      } else {
        setDownloadingBelumMenerimaPdf(false);
      }
    }
  };

  const isSlotFull = setup ? winners.length >= setup.jumlah_pemenang : false;
  const selectedWinnerCount = selectedWinnerIds.size;
  const allWinnersSelected = winners.length > 0 && selectedWinnerCount === winners.length;
  const winnersPerDraw = setup?.jumlah_per_undi ?? 10;
  const canStart = spinState === "idle" && !!setup && !isSlotFull && !loadingDetail && hadirCount !== 0 && eligibleCount !== 0 && !undiError;
  const highlightedWinnerIds = new Set(lastWinners.map((winner) => winner.id));

  const openUndian = () => {
    setDisplayName(null);
    setLastWinners([]);
    setSpinState("idle");
    setUndianOpen(true);
  };

  const closeUndian = () => {
    if (spinState !== "idle") return;
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    slowingRef.current = false;
    setDisplayName(null);
    setLastWinners([]);
    setCelebrating(false);
    setUndianOpen(false);
  };

  return (
    <AppLayout searchPlaceholder="Cari arisan...">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md border border-outline-variant">
            <div className="p-6 border-b border-outline-variant flex items-center justify-between">
              <div>
                <h2 className="font-h3 text-h3 text-on-surface">Setup Arisan</h2>
                {kegiatanInfo && (
                  <p className="text-body-sm text-on-surface-variant mt-0.5 truncate max-w-[300px]">
                    {kegiatanInfo.judul} · {formatTanggal(kegiatanInfo.tanggal)}
                  </p>
                )}
              </div>
              <button onClick={() => setSetupOpen(false)} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5">
              {setupError && (
                <div className="p-3 bg-error-container text-error rounded-lg text-body-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {setupError}
                </div>
              )}
              <div>
                <label className="text-label-sm text-on-surface-variant block mb-1.5">Nominal per Orang (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={nominal}
                  onChange={(e) => setNominal(e.target.value)}
                  className={INPUT_CLS}
                />
                {Number(nominal) > 0 && Number(jumlahPemenang) > 0 && (
                  <p className="text-[11px] text-on-surface-variant mt-1">
                    Perkiraan kas terkumpul: {formatRupiah(Number(nominal) * Number(jumlahPemenang))}
                  </p>
                )}
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant block mb-1.5">Jumlah Pemenang Kegiatan</label>
                <input
                  type="number"
                  min={1}
                  value={jumlahPemenang}
                  onChange={(e) => setJumlahPemenang(e.target.value)}
                  className={INPUT_CLS}
                />
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Total anggota yang akan mendapat arisan pada kegiatan ini.
                </p>
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant block mb-1.5">Jumlah Pemenang dalam 1 Pengundian</label>
                <input
                  type="number"
                  min={1}
                  value={jumlahPerUndi}
                  onChange={(e) => setJumlahPerUndi(e.target.value)}
                  className={INPUT_CLS}
                />
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Jumlah ini dipakai setiap tombol STOP ditekan.
                </p>
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSetupOpen(false)}>Batal</Button>
              <Button onClick={handleSaveSetup} disabled={savingSetup} icon="save">
                {savingSetup ? "Menyimpan..." : "Simpan Setup"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <nav className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
              <span>Beranda</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-primary font-semibold">Arisan</span>
            </nav>
            <h2 className="font-h1 text-h1 text-primary">Arisan Anggota</h2>
            <p className="text-body-lg text-on-surface-variant max-w-2xl mt-1">
              Atur nominal arisan per kegiatan, lalu undi pemenang secara transparan dengan
              mekanisme Start &amp; Stop.
            </p>
          </div>
          {/* Tab toggle */}
          <div className="flex flex-wrap rounded-lg border border-outline-variant overflow-hidden self-start md:self-end">
            <button
              onClick={() => setPageTab("per_kegiatan")}
              className={`flex items-center gap-2 px-4 py-2.5 text-label-md transition-colors ${pageTab === "per_kegiatan" ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container"}`}
            >
              <span className="material-symbols-outlined text-[18px]">savings</span>
              Per Kegiatan
            </button>
            <button
              onClick={() => setPageTab("manual")}
              className={`flex items-center gap-2 px-4 py-2.5 text-label-md transition-colors ${pageTab === "manual" ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container"}`}
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              Input Manual
            </button>
            <button
              onClick={() => setPageTab("belum_menerima")}
              className={`flex items-center gap-2 px-4 py-2.5 text-label-md transition-colors ${pageTab === "belum_menerima" ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container"}`}
            >
              <span className="material-symbols-outlined text-[18px]">fact_check</span>
              Belum Menerima
            </button>
            <button
              onClick={() => setPageTab("riwayat")}
              className={`flex items-center gap-2 px-4 py-2.5 text-label-md transition-colors ${pageTab === "riwayat" ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container"}`}
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              Riwayat Lintas Tahun
            </button>
          </div>
        </div>

        {/* Per Kegiatan / Riwayat toggle content */}
        {pageTab === "per_kegiatan" ? (<>
        {/* Kegiatan Selector Bar */}
        <Card className="p-5">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex-1">
              <label className="text-label-sm text-on-surface-variant block mb-1">Pilih Kegiatan</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">event</span>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
                  className={`${SELECT_CLS} pl-10`}
                >
                  <option value="">— Pilih kegiatan untuk arisan —</option>
                  {kegiatanList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {formatTanggal(k.tanggal)} · {k.judul}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>
            {selectedId && (
              <div className="flex gap-2 shrink-0 self-end">
                <Button
                  icon="tune"
                  onClick={() => setSetupOpen(true)}
                >
                  Setup Arisan
                </Button>
                <Button variant="outline" icon="restart_alt" onClick={handleResetArisan}>
                  Reset
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Empty state */}
        {!selectedId && (
          <Card className="p-16 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[72px] block mb-4 opacity-20">savings</span>
            <p className="text-body-md font-semibold">Pilih kegiatan terlebih dahulu</p>
            <p className="text-body-sm mt-1">Gunakan dropdown di atas untuk memilih kegiatan arisan.</p>
          </Card>
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
                <span className="material-symbols-outlined material-symbols-filled text-primary text-[28px]">savings</span>
                <div>
                  <h2 className="font-bold text-on-surface text-lg leading-tight">Pengundian Arisan</h2>
                  {kegiatanInfo && (
                    <p className="text-on-surface-variant text-[12px]">{kegiatanInfo.judul} · {formatTanggal(kegiatanInfo.tanggal)}</p>
                  )}
                </div>
              </div>
              {setup && (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-on-surface-variant text-[10px] uppercase tracking-widest">NOMINAL</p>
                    <p className="text-primary font-bold text-[16px]">{formatRupiah(Number(setup.nominal_per_orang))}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-on-surface-variant text-[10px] uppercase tracking-widest">PEMENANG</p>
                    <p className="text-on-surface font-bold text-[16px]">{winners.length} / {setup.jumlah_pemenang}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-on-surface-variant text-[10px] uppercase tracking-widest">SISA SLOT</p>
                    <p className="text-on-surface font-bold text-[16px]">{Math.max(0, setup.jumlah_pemenang - winners.length)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-on-surface-variant text-[10px] uppercase tracking-widest">PER UNDI</p>
                    <p className="text-on-surface font-bold text-[16px]">{winnersPerDraw} orang</p>
                  </div>
                  <div className="text-center">
                    <p className="text-on-surface-variant text-[10px] uppercase tracking-widest">PESERTA HADIR</p>
                    <p className={`font-bold text-[16px] ${hadirCount === 0 ? "text-error" : "text-tertiary"}`}>
                      {hadirCount ?? "–"} orang
                    </p>
                  </div>
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

            {/* Center spin area */}
            <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8 py-8 relative overflow-y-auto">

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
                {spinState === "idle" && lastWinners.length > 0 && "🏆 Pemenang!"}
                {spinState === "idle" && lastWinners.length === 0 && !isSlotFull && "Siap Mengundi"}
                {spinState === "idle" && lastWinners.length === 0 && isSlotFull && "✅ Pengundian Sudah Habis"}
              </div>

              {/* No eligible banner */}
              {spinState === "idle" && (isSlotFull || hadirCount === 0 || eligibleCount === 0 || undiError) && (
                <div className="mx-8 px-6 py-4 rounded-2xl bg-error-container border border-error/30 flex items-start gap-3 text-error">
                  <span className="material-symbols-outlined text-[22px] mt-0.5 shrink-0">group_off</span>
                  <div>
                    <p className="font-bold text-[14px]">
                      {hadirCount === 0 ? "Tidak ada peserta yang hadir" : "Pengundian sudah habis"}
                    </p>
                    <p className="text-[12px] mt-0.5 opacity-80">
                      {isSlotFull
                        ? "Semua jatah pemenang sudah terisi."
                        : hadirCount === 0
                        ? "Belum ada anggota yang melakukan presensi di kegiatan ini."
                        : undiError ?? "Semua peserta yang hadir sudah pernah mendapat arisan tahun ini."}
                    </p>
                  </div>
                </div>
              )}

              {/* Name display */}
              <div className="text-center">
                <p className="text-on-surface-variant text-[11px] uppercase tracking-[0.3em] mb-4">
                  {spinState === "idle" && lastWinners.length > 0 ? "PEMENANG ARISAN" : "NAMA PESERTA"}
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
                          Pemenang ke-{winner.urutan}
                        </p>
                        <h2 className="text-2xl font-bold text-primary uppercase leading-tight break-words">
                          {winner.nama}
                        </h2>
                        <p className="mt-3 text-[13px] text-on-primary-fixed-variant shimmer-text">
                          {winner.unit_kerja} · {winner.jabatan}
                        </p>
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
                    {displayName ?? "— — —"}
                  </h1>
                )}
              </div>

              {/* Controls */}
              <div className="sticky bottom-0 z-20 w-full max-w-3xl rounded-2xl border border-outline-variant bg-surface-container-lowest/95 px-6 py-4 shadow-xl backdrop-blur">
                <div className="flex justify-center gap-6">
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

                <p className="text-on-surface-variant text-[12px] text-center mt-3">
                  {isSlotFull
                    ? "Pengundian sudah habis. Semua jatah pemenang sudah terisi."
                    : lastWinners.length > 0
                    ? `Klik MULAI untuk mengundi putaran berikutnya dengan maksimal ${winnersPerDraw} pemenang lagi.`
                    : `Klik MULAI untuk memutar nama, lalu klik STOP untuk memilih maksimal ${winnersPerDraw} pemenang sekaligus.`}
                </p>
              </div>
            </div>

            {/* Bottom: mini winners list */}
            {winners.length > 0 && (
              <div className="px-8 pb-6">
                <div className="border border-outline-variant rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-surface-container border-b border-outline-variant flex items-center gap-2">
                    <span className="material-symbols-outlined material-symbols-filled text-secondary text-[16px]">emoji_events</span>
                    <span className="text-on-surface-variant text-[12px] font-semibold uppercase tracking-widest">Pemenang Sejauh Ini</span>
                    <span className="ml-auto text-on-surface-variant text-[11px]">{winners.length} orang</span>
                  </div>
                  <div className="flex gap-3 px-5 py-3 overflow-x-auto bg-surface-container-lowest">
                    {winners.map((w) => (
                      <div
                        key={w.id}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border ${
                          highlightedWinnerIds.has(w.id)
                            ? "bg-primary-fixed border-primary/40"
                            : "bg-surface-container border-outline-variant"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-secondary-fixed flex items-center justify-center font-bold text-secondary text-[12px]">
                          {w.urutan}
                        </div>
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
                        <span className="text-on-surface text-[13px] font-medium whitespace-nowrap">{w.nama}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedId && (
          <>
            {/* Info chips */}
            {kegiatanInfo && (
              <div className="flex flex-wrap gap-3">
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
                {setup ? (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-fixed border border-primary/20 text-body-sm text-on-primary-fixed-variant">
                      <span className="material-symbols-outlined text-[16px]">payments</span>
                      {formatRupiah(Number(setup.nominal_per_orang))} / orang
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary-fixed border border-secondary/20 text-body-sm text-on-secondary-fixed-variant">
                      <span className="material-symbols-outlined text-[16px]">group</span>
                      {winners.length} / {setup.jumlah_pemenang} pemenang
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-tertiary-container border border-tertiary/20 text-body-sm text-on-tertiary-container">
                      <span className="material-symbols-outlined text-[16px]">groups</span>
                      {setup.jumlah_per_undi ?? 10} pemenang / pengundian
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setSetupOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-error-container border border-error/20 text-body-sm text-error hover:bg-error/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    Setup belum diisi — Klik untuk mengatur
                  </button>
                )}
              </div>
            )}

            {/* Undi Button */}
            {setup && !isSlotFull && (
              <div>
                <button
                  onClick={openUndian}
                  className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-on-primary font-bold text-body-md shadow-lg hover:opacity-90 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined material-symbols-filled text-[24px]">play_circle</span>
                  Mulai Pengundian
                </button>
              </div>
            )}
            {setup && isSlotFull && (
              <div className="flex items-start gap-3 rounded-xl border border-tertiary/20 bg-tertiary-container px-5 py-4 text-on-tertiary-container">
                <span className="material-symbols-outlined text-[22px] shrink-0">task_alt</span>
                <div>
                  <p className="font-bold text-[14px]">Pengundian sudah habis</p>
                  <p className="text-[12px] mt-0.5 opacity-80">
                    Semua jatah pemenang sudah terisi. Batalkan pemenang terlebih dahulu jika perlu membuka slot pengundian lagi.
                  </p>
                </div>
              </div>
            )}

            {/* Winners list */}
            <Card className="flex flex-col">
              <div className="p-6 border-b border-outline-variant flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined material-symbols-filled text-secondary text-[22px]">emoji_events</span>
                  <h4 className="font-h3 text-[20px] text-on-surface">Daftar Pemenang</h4>
                </div>
                <div className="flex items-center gap-3">
                  <Badge label={`${winners.length} orang`} variant="info" />
                  {selectedWinnerCount > 0 && (
                    <button
                      onClick={() => void handleBatalkanSelectedWinners()}
                      disabled={cancellingSelected}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-error text-error text-[12px] font-medium hover:bg-error-container/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[16px]">undo</span>
                      {cancellingSelected ? "Membatalkan..." : `Batalkan ${selectedWinnerCount} Terpilih`}
                    </button>
                  )}
                  {isSlotFull && (
                    <button
                      onClick={openUndian}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary text-primary text-[12px] font-medium hover:bg-primary/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                      Lihat Layar Penuh
                    </button>
                  )}
                </div>
              </div>

              {winners.length === 0 ? (
                <div className="text-center py-14 text-on-surface-variant flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-[56px] opacity-20">savings</span>
                  <p className="text-body-sm">Belum ada pemenang.</p>
                  <p className="text-[11px]">Klik tombol &ldquo;Mulai Pengundian&rdquo; untuk mengundi.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-body-sm">
                    <thead>
                      <tr className="bg-surface-container border-b border-outline-variant text-on-surface-variant text-[11px] uppercase tracking-widest">
                        <th className="px-4 py-3 text-center w-10">
                          <input
                            type="checkbox"
                            aria-label="Pilih semua pemenang"
                            checked={allWinnersSelected}
                            onChange={toggleAllWinners}
                            className="h-4 w-4 accent-primary"
                          />
                        </th>
                        <th className="px-5 py-3 text-center w-12">#</th>
                        <th className="px-5 py-3 text-center">Foto</th>
                        <th className="px-5 py-3 text-left">Nama</th>
                        <th className="px-5 py-3 text-left">NIP</th>
                        <th className="px-5 py-3 text-left">Jabatan</th>
                        <th className="px-5 py-3 text-left">Unit Kerja</th>
                        <th className="px-5 py-3 text-center">Waktu</th>
                        <th className="px-3 py-3 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {winners.map((w) => (
                        <tr
                          key={w.id}
                          className={`hover:bg-surface-container-low transition-colors ${
                            selectedWinnerIds.has(w.id) ? "bg-primary-fixed/40" : ""
                          }`}
                        >
                          <td className="px-4 py-3.5 text-center">
                            <input
                              type="checkbox"
                              aria-label={`Pilih pemenang ${w.nama}`}
                              checked={selectedWinnerIds.has(w.id)}
                              onChange={() => toggleWinnerSelection(w.id)}
                              className="h-4 w-4 accent-primary"
                            />
                          </td>
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
                          <td className="px-5 py-3.5 font-medium text-on-surface whitespace-nowrap">{w.nama}</td>
                          <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{w.nip || "-"}</td>
                          <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{w.jabatan}</td>
                          <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{w.unit_kerja}</td>
                          <td className="px-5 py-3.5 text-on-surface-variant text-center whitespace-nowrap text-[12px]">
                            {new Date(w.waktu).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <button
                              onClick={() => handleHapusWinner(w.id, w.nama)}
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
              )}

              {winners.length > 0 && (
                <div className="p-4 border-t border-outline-variant">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        const header = ["Urutan", "Nama", "NIP", "Jabatan", "Unit Kerja"];
                        const rows = winners.map((w) => [w.urutan, w.nama, w.nip, w.jabatan, w.unit_kerja]);
                        const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                        const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url;
                        a.download = `pemenang-arisan-${kegiatanInfo?.event_code ?? selectedId}.csv`;
                        a.click(); URL.revokeObjectURL(url);
                      }}
                      className="w-full py-2.5 border border-secondary text-secondary rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-secondary-container/10 transition-colors text-label-md"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      Unduh Hasil (.csv)
                    </button>
                    <button
                      onClick={() => void handleDownloadWinnersPdf()}
                      disabled={downloadingPdf}
                      className="w-full py-2.5 border border-primary text-primary rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors text-label-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                      {downloadingPdf ? "Mengunduh PDF..." : "Unduh Hasil (.pdf)"}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
        </>) : pageTab === "manual" ? (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
            <Card className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined material-symbols-filled text-[26px]">edit_note</span>
                </div>
                <div>
                  <h3 className="font-h3 text-[22px] text-on-surface">Input Manual Penerima Arisan</h3>
                  <p className="text-body-sm text-on-surface-variant mt-1 max-w-2xl">
                    Gunakan menu ini untuk mencatat anggota DWP yang sudah menerima arisan tanpa menjalankan proses undian.
                    Data akan masuk ke riwayat pemenang arisan dan tetap divalidasi agar tidak dobel dalam tahun yang sama.
                  </p>
                </div>
              </div>

              {manualError && (
                <div className="mb-5 p-3 bg-error-container text-error rounded-lg text-body-sm flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
                  <span>{manualError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-label-sm text-on-surface-variant block mb-1.5">Kegiatan Arisan</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">event</span>
                    <select
                      value={manualKegiatanId}
                      onChange={(e) => setManualKegiatanId(e.target.value)}
                      className={`${SELECT_CLS} pl-10 pr-10`}
                    >
                      <option value="">— Pilih kegiatan —</option>
                      {kegiatanList.map((k) => (
                        <option key={k.id} value={k.id}>
                          {formatTanggal(k.tanggal)} · {k.judul}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">expand_more</span>
                  </div>
                </div>

                <div>
                  <label className="text-label-sm text-on-surface-variant block mb-1.5">Pencarian Penerima berdasarkan NIP atau Nama</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">search</span>
                    <input
                      type="search"
                      value={manualSearch}
                      onChange={(e) => {
                        setManualSearch(e.target.value);
                        setManualAnggotaId("");
                        setManualSearchOpen(true);
                      }}
                      onFocus={() => setManualSearchOpen(true)}
                      placeholder="Ketik NIP atau nama anggota..."
                      className={`${INPUT_CLS} pl-10 pr-10`}
                    />
                    {manualSearchLoading && (
                      <span className="material-symbols-outlined animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-primary text-[18px]">progress_activity</span>
                    )}
                  </div>
                  {manualSearchOpen && !manualAnggotaId && (
                    <div className="mt-2 rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden max-h-56 overflow-y-auto">
                      {anggotaOptions.length === 0 ? (
                        <div className="px-4 py-3 text-body-sm text-on-surface-variant">
                          {manualSearchLoading ? "Mencari anggota..." : "Tidak ada anggota aktif yang cocok."}
                        </div>
                      ) : (
                        anggotaOptions.map((a) => (
                          <button
                            type="button"
                            key={a.id}
                            onClick={() => {
                              setManualAnggotaId(String(a.id));
                              setManualSearch(`${a.nama}${a.nip ? ` · ${a.nip}` : ""}`);
                              setManualSearchOpen(false);
                              setManualDuplicateMessage(null);
                            }}
                            className="w-full px-4 py-3 text-left flex items-start gap-3 border-b last:border-b-0 border-outline-variant/40 hover:bg-surface-container transition-colors"
                          >
                            <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">person_check</span>
                            <span className="min-w-0">
                              <span className="block font-medium text-on-surface truncate">{a.nama}</span>
                              <span className="block text-[11px] text-on-surface-variant truncate">
                                NIP: {a.nip || "-"} · {a.jabatan} · {a.unit_kerja}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {manualAnggotaId && (
                    <div className="mt-2 px-4 py-3 rounded-xl border border-primary/30 bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                        <span className="text-body-sm font-medium truncate">Penerima dipilih: {manualSearch}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setManualAnggotaId("");
                          setManualSearch("");
                          setManualSearchOpen(true);
                          setManualDuplicateMessage(null);
                        }}
                        className="text-primary hover:underline text-[12px] font-medium shrink-0"
                      >
                        Ganti
                      </button>
                    </div>
                  )}
                  {manualDuplicateChecking && manualAnggotaId && (
                    <div className="mt-2 px-4 py-3 rounded-xl border border-outline-variant bg-surface-container text-body-sm text-on-surface-variant flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-primary text-[18px]">progress_activity</span>
                      Mengecek riwayat penerima pada tahun kegiatan...
                    </div>
                  )}
                  {manualDuplicateMessage && (
                    <div className="mt-2 px-4 py-3 rounded-xl border border-error/30 bg-error-container text-body-sm text-error flex items-start gap-2">
                      <span className="material-symbols-outlined text-[18px] mt-0.5">block</span>
                      <span>{manualDuplicateMessage}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-[12px] text-on-surface-variant">
                  Catatan: anggota yang sudah tercatat menerima arisan pada tahun kegiatan yang sama tidak dapat diinput ulang.
                </p>
                <Button onClick={handleManualSubmit} disabled={manualSaving || manualDuplicateChecking || !!manualDuplicateMessage} icon="save">
                  {manualSaving ? "Menyimpan..." : "Simpan Penerima"}
                </Button>
              </div>
            </Card>

            <Card className="p-6 bg-surface-container-low">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-secondary">info</span>
                <h4 className="font-h3 text-[18px] text-on-surface">Panduan Input</h4>
              </div>
              <ul className="space-y-3 text-body-sm text-on-surface-variant">
                <li className="flex gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">looks_one</span>
                  Pilih kegiatan sebagai periode pencatatan arisan.
                </li>
                <li className="flex gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">looks_two</span>
                  Cari penerima berdasarkan NIP atau nama, lalu pilih anggota dari hasil pencarian.
                </li>
                <li className="flex gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">looks_3</span>
                  Klik simpan, lalu data akan muncul di daftar pemenang dan riwayat lintas tahun.
                </li>
              </ul>
            </Card>
          </div>
        ) : pageTab === "belum_menerima" ? (
          <Card>
            <div className="p-6 border-b border-outline-variant flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined material-symbols-filled text-primary text-[22px]">fact_check</span>
                <div>
                  <h4 className="font-h3 text-[20px] text-on-surface">Anggota Belum Menerima Arisan</h4>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">
                    Periode Januari sampai {formatBulan(belumMenerimaMonth)} {belumMenerimaYear}.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">calendar_month</span>
                  <select
                    value={belumMenerimaMonth}
                    onChange={(e) => setBelumMenerimaMonth(e.target.value)}
                    className="appearance-none pl-9 pr-8 py-2 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface min-w-[140px]"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">expand_more</span>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">calendar_today</span>
                  <select
                    value={belumMenerimaYear}
                    onChange={(e) => setBelumMenerimaYear(e.target.value)}
                    className="appearance-none pl-9 pr-8 py-2 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface min-w-[120px]"
                  >
                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">expand_more</span>
                </div>
                <button
                  onClick={() => void handleDownloadBelumMenerima("excel")}
                  disabled={downloadingBelumMenerimaExcel || belumMenerimaLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-secondary text-secondary hover:bg-secondary-container/10 text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">table_view</span>
                  {downloadingBelumMenerimaExcel ? "Mengunduh..." : "Excel"}
                </button>
                <button
                  onClick={() => void handleDownloadBelumMenerima("pdf")}
                  disabled={downloadingBelumMenerimaPdf || belumMenerimaLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/5 text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                  {downloadingBelumMenerimaPdf ? "Mengunduh..." : "PDF"}
                </button>
              </div>
            </div>

            <div className="p-6 border-b border-outline-variant grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">Belum Menerima</p>
                <p className="text-[24px] font-bold text-primary mt-1">
                  {belumMenerimaSummary?.total_belum_menerima ?? 0}
                  <span className="text-body-sm font-medium text-on-surface-variant ml-1">orang</span>
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">Sudah Menerima</p>
                <p className="text-[24px] font-bold text-secondary mt-1">
                  {belumMenerimaSummary?.total_sudah_menerima ?? 0}
                  <span className="text-body-sm font-medium text-on-surface-variant ml-1">orang</span>
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">Total Anggota Eligible</p>
                <p className="text-[24px] font-bold text-tertiary mt-1">
                  {belumMenerimaSummary?.total_anggota_eligible ?? 0}
                  <span className="text-body-sm font-medium text-on-surface-variant ml-1">orang</span>
                </p>
              </div>
            </div>

            {belumMenerimaLoading ? (
              <div className="p-12 flex items-center justify-center">
                <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
              </div>
            ) : belumMenerimaRows.length === 0 ? (
              <div className="py-14 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[56px] block mb-3 opacity-20">task_alt</span>
                <p className="text-body-sm">Semua anggota eligible sudah menerima arisan pada periode ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant text-on-surface-variant text-[11px] uppercase tracking-widest">
                      <th className="px-5 py-3 text-center w-10">#</th>
                      <th className="px-5 py-3 text-left">Nama</th>
                      <th className="px-5 py-3 text-left">NIP</th>
                      <th className="px-5 py-3 text-left">Jabatan</th>
                      <th className="px-5 py-3 text-left">Unit Kerja</th>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-left">Kontak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {belumMenerimaRows.map((row, index) => (
                      <tr key={row.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-primary-fixed text-primary font-bold text-[12px]">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-on-surface whitespace-nowrap">{row.nama}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{row.nip || "-"}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{row.jabatan || "-"}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{row.unit_kerja || "-"}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{row.status_keanggotaan || "-"}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap text-[12px]">
                          {row.no_hp || row.email ? (
                            <>
                              {row.no_hp && <p>{row.no_hp}</p>}
                              {row.email && <p>{row.email}</p>}
                            </>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          /* Riwayat Lintas Tahun */
          <Card>
            <div className="p-6 border-b border-outline-variant flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined material-symbols-filled text-primary text-[22px]">history</span>
                <h4 className="font-h3 text-[20px] text-on-surface">Riwayat Pemenang Arisan</h4>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">calendar_month</span>
                  <select
                    value={allWinnersMonth}
                    onChange={(e) => setAllWinnersMonth(e.target.value)}
                    className="appearance-none pl-9 pr-8 py-2 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface min-w-[140px]"
                  >
                    <option value="">Semua Bulan</option>
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">expand_more</span>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">calendar_today</span>
                  <select
                    value={allWinnersYear}
                    onChange={(e) => setAllWinnersYear(e.target.value)}
                    className="appearance-none pl-9 pr-8 py-2 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface min-w-[120px]"
                  >
                    <option value="">Semua Tahun</option>
                    {allWinnersYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">expand_more</span>
                </div>
                <Badge label={`${allWinners.length} pemenang`} variant="info" />
                {allWinners.length > 0 && (
                  <button
                    onClick={() => {
                      const header = ["No", "Nama", "NIP", "Jabatan", "Unit Kerja", "Acara", "Bulan", "Tanggal Acara", "Nominal", "Waktu Menang"];
                      const rows = allWinners.map((w, i) => [
                        i + 1, w.nama, w.nip, w.jabatan, w.unit_kerja,
                        w.kegiatan_judul, formatBulan(w.kegiatan_bulan), new Date(w.kegiatan_tanggal).toLocaleDateString("id-ID"),
                        w.nominal_per_orang ? formatRupiah(Number(w.nominal_per_orang)) : "-",
                        new Date(w.waktu).toLocaleString("id-ID"),
                      ]);
                      const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                      const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url;
                      a.download = `riwayat-arisan${allWinnersMonth ? `-${formatBulan(allWinnersMonth).toLowerCase()}` : ""}${allWinnersYear ? `-${allWinnersYear}` : ""}.csv`;
                      a.click(); URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container text-[12px] font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    CSV
                  </button>
                )}
              </div>
            </div>

            {allWinnersLoading ? (
              <div className="p-12 flex items-center justify-center">
                <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
              </div>
            ) : allWinners.length === 0 ? (
              <div className="py-14 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[56px] block mb-3 opacity-20">savings</span>
                <p className="text-body-sm">
                  Belum ada data pemenang arisan
                  {allWinnersMonth ? ` bulan ${formatBulan(allWinnersMonth)}` : ""}
                  {allWinnersYear ? ` tahun ${allWinnersYear}` : ""}.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant text-on-surface-variant text-[11px] uppercase tracking-widest">
                      <th className="px-5 py-3 text-center w-10">#</th>
                      <th className="px-5 py-3 text-left">Nama</th>
                      <th className="px-5 py-3 text-left">Unit Kerja</th>
                      <th className="px-5 py-3 text-left">Kegiatan</th>
                      <th className="px-5 py-3 text-center">Bulan</th>
                      <th className="px-5 py-3 text-center">Tanggal</th>
                      <th className="px-5 py-3 text-right">Nominal</th>
                      <th className="px-5 py-3 text-center">Waktu Menang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {allWinners.map((w) => (
                      <tr key={w.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-secondary-fixed text-secondary font-bold text-[12px]">
                            {w.urutan}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-on-surface whitespace-nowrap">{w.nama}</p>
                          <p className="text-[11px] text-on-surface-variant">{w.jabatan}</p>
                        </td>
                        <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{w.unit_kerja}</td>
                        <td className="px-5 py-3.5">
                          <a href={`/kegiatan/${w.kegiatan_id}`} className="font-medium text-on-surface hover:text-primary transition-colors whitespace-nowrap block">
                            {w.kegiatan_judul}
                          </a>
                          {w.lokasi && <p className="text-[11px] text-on-surface-variant">{w.lokasi}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-center text-on-surface-variant whitespace-nowrap text-[12px]">
                          {formatBulan(w.kegiatan_bulan)}
                        </td>
                        <td className="px-5 py-3.5 text-center text-on-surface-variant whitespace-nowrap text-[12px]">
                          {formatTanggal(w.kegiatan_tanggal)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-secondary whitespace-nowrap">
                          {w.nominal_per_orang ? formatRupiah(Number(w.nominal_per_orang)) : "-"}
                        </td>
                        <td className="px-5 py-3.5 text-center text-on-surface-variant whitespace-nowrap text-[12px]">
                          {new Date(w.waktu).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
