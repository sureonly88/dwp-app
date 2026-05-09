"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";

interface Kegiatan {
  id: number;
  judul: string;
  deskripsi: string | null;
  tanggal: string;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  lokasi: string | null;
  kategori: string;
  status: "Mendatang" | "Berlangsung" | "Selesai" | "Dibatalkan";
  event_code: string;
  hadir_count: number;
}

interface AnggotaSuggest {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  sudah_hadir: 0 | 1;
}

function formatTanggal(dateStr: string) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function formatJam(t: string | null) { return t ? t.slice(0, 5) : ""; }
function getInitials(nama: string) {
  return nama.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function PresensiPublicPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  const [kegiatan, setKegiatan] = useState<Kegiatan | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Step state: search -> selfie -> result
  const [step, setStep] = useState<"search" | "selfie" | "done">("search");

  // Presence type selection
  const [presType, setPresType] = useState<"anggota" | "tamu" | null>(null);

  // Search
  const [query, setQuery] = useState("");
  const [suggest, setSuggest] = useState<AnggotaSuggest[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<AnggotaSuggest | null>(null);

  // Selfie
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [cameraErr, setCameraErr] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { type: "success"; nama: string; jabatan?: string; unit_kerja?: string; foto: string | null; isTamu?: boolean }
    | { type: "duplicate"; nama: string }
    | { type: "error"; msg: string }
    | null
  >(null);

  // Tamu form
  const [tamuNama, setTamuNama] = useState("");
  const [tamuInstansi, setTamuInstansi] = useState("");

  const refreshKegiatan = useCallback(async () => {
    try {
      const res = await fetch(`/api/presensi/${code}`);
      const json = await res.json();
      if (res.ok) setKegiatan(json);
      else setLoadErr(json.error ?? "Kode kegiatan tidak valid");
    } catch {
      setLoadErr("Tidak dapat memuat data kegiatan");
    }
  }, [code]);

  useEffect(() => {
    refreshKegiatan().finally(() => setLoading(false));
  }, [refreshKegiatan]);

  // Live search debounced
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setSuggest([]);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: query });
        const res = await fetch(`/api/presensi/${code}/anggota?${params}`);
        if (res.ok) {
          const json = await res.json();
          setSuggest(json.data ?? []);
        }
      } catch {
        setSuggest([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, code]);

  // Camera lifecycle
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Tidak dapat mengakses kamera";
      setCameraErr(msg.includes("Permission") || msg.includes("NotAllowed")
        ? "Izin kamera ditolak. Buka pengaturan browser dan izinkan akses kamera."
        : "Kamera tidak tersedia di perangkat ini.");
    }
  }, []);

  // Auto start camera when entering selfie step
  useEffect(() => {
    if (step === "selfie" && !photoData) {
      startCamera();
    }
    return () => {
      if (step !== "selfie") stopCamera();
    };
  }, [step, photoData, startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const size = Math.min(video.videoWidth, video.videoHeight) || 480;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror for natural selfie appearance
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const data = canvas.toDataURL("image/jpeg", 0.7);
    setPhotoData(data);
    stopCamera();
  };

  const retakePhoto = () => {
    setPhotoData(null);
    startCamera();
  };

  const handleSubmitTamu = () => {
    if (!tamuNama.trim()) return;
    setStep("selfie");
  };

  const handleSelectAnggota = (a: AnggotaSuggest) => {
    if (a.sudah_hadir) {
      setResult({ type: "duplicate", nama: a.nama });
      setStep("done");
      return;
    }
    setSelected(a);
    setStep("selfie");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      if (presType === "tamu") {
        if (!tamuNama.trim() || !kegiatan) return;
        const res = await fetch(`/api/kegiatan/${kegiatan.id}/presensi/tamu`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nama: tamuNama.trim(), instansi: tamuInstansi.trim() || undefined, foto: photoData }),
        });
        const json = await res.json();
        if (res.status === 201) {
          setResult({ type: "success", nama: json.nama, foto: photoData, isTamu: true });
          refreshKegiatan();
        } else {
          setResult({ type: "error", msg: json.error ?? "Gagal mencatat kehadiran" });
        }
      } else {
        if (!selected) return;
        const res = await fetch(`/api/presensi/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anggota_id: selected.id, foto: photoData }),
        });
        const json = await res.json();
        if (res.status === 201) {
          setResult({
            type: "success",
            nama: json.anggota.nama,
            jabatan: json.anggota.jabatan,
            unit_kerja: json.anggota.unit_kerja,
            foto: photoData,
          });
          refreshKegiatan();
        } else if (res.status === 409 && json.duplicate) {
          setResult({ type: "duplicate", nama: json.anggota?.nama ?? selected.nama });
        } else {
          setResult({ type: "error", msg: json.error ?? "Gagal mencatat kehadiran" });
        }
      }
      setStep("done");
      stopCamera();
    } catch {
      setResult({ type: "error", msg: "Tidak dapat terhubung ke server" });
      setStep("done");
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setQuery("");
    setSuggest([]);
    setSelected(null);
    setPhotoData(null);
    setResult(null);
    setStep("search");
    setPresType(null);
    setTamuNama("");
    setTamuInstansi("");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <div className="text-on-surface-variant inline-flex items-center gap-2">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Memuat...
        </div>
      </main>
    );
  }

  if (loadErr || !kegiatan) {
    return (
      <main className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <span className="material-symbols-outlined text-error text-[56px] mb-3 block">error</span>
          <h1 className="font-h3 text-h3 text-on-surface mb-2">Kode Tidak Valid</h1>
          <p className="text-on-surface-variant text-body-sm">{loadErr ?? "Kegiatan tidak ditemukan."}</p>
        </div>
      </main>
    );
  }

  const isClosed = kegiatan.status === "Selesai" || kegiatan.status === "Dibatalkan";

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-fixed to-surface-container-low p-4 sm:p-6">
      <div className="max-w-md mx-auto pt-6 pb-12">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary text-on-primary rounded-2xl mb-3 shadow-sm">
            <span className="material-symbols-outlined material-symbols-filled text-[28px]">account_balance</span>
          </div>
          <h1 className="font-h3 text-h3 text-primary leading-tight">Presensi DWP</h1>
          <p className="text-label-sm text-on-surface-variant uppercase tracking-widest">Dharma Wanita Persatuan</p>
        </div>

        {/* Event Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{kegiatan.kategori}</span>
            <span className={`text-label-sm font-semibold px-2.5 py-0.5 rounded-full ${
              kegiatan.status === "Berlangsung" ? "bg-tertiary-fixed text-on-tertiary-fixed-variant"
              : kegiatan.status === "Mendatang" ? "bg-primary-fixed text-on-primary-fixed-variant"
              : "bg-surface-container-high text-on-surface-variant"
            }`}>{kegiatan.status}</span>
          </div>
          <h2 className="font-h3 text-h3 text-on-surface leading-snug mb-3">{kegiatan.judul}</h2>
          <div className="space-y-2 text-body-sm text-on-surface-variant">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              {formatTanggal(kegiatan.tanggal)}
            </div>
            {kegiatan.waktu_mulai && (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                {formatJam(kegiatan.waktu_mulai)}
                {kegiatan.waktu_selesai ? ` – ${formatJam(kegiatan.waktu_selesai)}` : ""}
              </div>
            )}
            {kegiatan.lokasi && (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">location_on</span>
                {kegiatan.lokasi}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
              <strong className="text-on-surface">{kegiatan.hadir_count}</strong> anggota hadir
            </div>
          </div>
        </div>

        {/* Closed message */}
        {isClosed && (
          <div className="bg-error-container border border-error/30 rounded-2xl p-5 text-center">
            <span className="material-symbols-outlined text-error text-[40px] mb-2 block">block</span>
            <p className="text-error font-label-md">
              Presensi sudah ditutup. Kegiatan ini berstatus <strong>{kegiatan.status}</strong>.
            </p>
          </div>
        )}

        {/* Step: TYPE SELECTION */}
        {!isClosed && step === "search" && presType === null && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-5">
            <p className="font-label-md text-label-md text-on-surface font-semibold mb-4 text-center">Pilih jenis kehadiran</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setPresType("anggota")}
                className="w-full flex items-center gap-4 p-4 border-2 border-outline-variant rounded-xl hover:border-primary hover:bg-primary-fixed/20 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined material-symbols-filled text-primary text-[24px]">badge</span>
                </div>
                <div className="flex-1">
                  <p className="font-label-md text-label-md text-on-surface group-hover:text-primary">Anggota DWP</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Cari nama / NIP &amp; ambil foto selfie</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">chevron_right</span>
              </button>
              <button
                onClick={() => setPresType("tamu")}
                className="w-full flex items-center gap-4 p-4 border-2 border-outline-variant rounded-xl hover:border-secondary hover:bg-secondary-container/20 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-secondary text-[24px]">person_outline</span>
                </div>
                <div className="flex-1">
                  <p className="font-label-md text-label-md text-on-surface group-hover:text-secondary">Tamu (Non-Anggota)</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Isi nama &amp; instansi, tidak ikut undian</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-secondary">chevron_right</span>
              </button>
            </div>
          </div>
        )}

        {/* Step: SEARCH (Anggota) */}
        {!isClosed && step === "search" && presType === "anggota" && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-sm font-bold">1</div>
              <label className="text-label-md text-on-surface font-semibold">
                Cari nama Anda
              </label>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">search</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder="Ketik nama atau NIP..."
                className="w-full pl-10 pr-10 py-3 border border-outline-variant rounded-xl text-body-md bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
              />
              {searchLoading && (
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] animate-spin">progress_activity</span>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 max-h-[60vh] overflow-y-auto -mx-1 px-1">
              {query.trim().length < 2 ? (
                <p className="text-body-sm text-on-surface-variant text-center py-6">
                  Mulai ketik minimal 2 huruf untuk mencari.
                </p>
              ) : suggest.length === 0 && !searchLoading ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-on-surface-variant text-[40px] opacity-30 block mb-2">person_search</span>
                  <p className="text-body-sm text-on-surface-variant">Tidak ada anggota cocok.</p>
                </div>
              ) : (
                suggest.map((a) => {
                  const sudah = !!a.sudah_hadir;
                  return (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAnggota(a)}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        sudah
                          ? "border-tertiary-fixed-dim bg-tertiary-fixed/30"
                          : "border-outline-variant hover:border-primary hover:bg-primary-fixed/30"
                      }`}
                    >
                      <div className="w-11 h-11 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {getInitials(a.nama)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-label-md text-label-md text-on-surface leading-tight truncate">{a.nama}</p>
                        <p className="text-[11px] text-on-surface-variant truncate">{a.jabatan} · {a.unit_kerja}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">{a.nip}</p>
                      </div>
                      {sudah ? (
                        <span className="inline-flex items-center gap-1 text-label-sm text-tertiary font-semibold flex-shrink-0">
                          <span className="material-symbols-outlined material-symbols-filled text-[18px]">check_circle</span>
                          Hadir
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-primary flex-shrink-0">chevron_right</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Step: TAMU FORM */}
        {!isClosed && step === "search" && presType === "tamu" && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setPresType(null)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <div>
                <p className="font-label-md text-label-md text-on-surface font-semibold">Data Tamu</p>
                <p className="text-[11px] text-on-surface-variant">Tidak ikut pengundian Arisan &amp; Doorprize</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-label-sm text-on-surface-variant mb-1 block">Nama <span className="text-error">*</span></label>
                <input
                  autoFocus
                  value={tamuNama}
                  onChange={(e) => setTamuNama(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitTamu()}
                  placeholder="Nama lengkap tamu"
                  className="w-full px-4 py-3 border border-outline-variant rounded-xl text-body-md bg-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 text-on-surface"
                />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant mb-1 block">Instansi / Asal <span className="text-on-surface-variant">(opsional)</span></label>
                <input
                  value={tamuInstansi}
                  onChange={(e) => setTamuInstansi(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitTamu()}
                  placeholder="Nama instansi atau organisasi"
                  className="w-full px-4 py-3 border border-outline-variant rounded-xl text-body-md bg-surface focus:border-secondary focus:outline-none text-on-surface"
                />
              </div>
              <button
                onClick={handleSubmitTamu}
                disabled={!tamuNama.trim()}
                className="w-full py-3 bg-secondary text-on-secondary rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-secondary/90 active:scale-[0.98] transition-all disabled:opacity-50 mt-1"
              >
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                Lanjut → Ambil Foto
              </button>
            </div>
          </div>
        )}

        {!isClosed && step === "selfie" && (presType === "anggota" ? !!selected : presType === "tamu") && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-sm font-bold">2</div>
              <label className="text-label-md text-on-surface font-semibold">
                Ambil foto selfie
              </label>
            </div>

            {presType === "anggota" && selected ? (
              <div className="bg-primary-fixed/30 border border-primary-fixed-dim rounded-xl p-3 mb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {getInitials(selected.nama)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label-md text-label-md text-on-surface leading-tight">{selected.nama}</p>
                  <p className="text-[11px] text-on-surface-variant">{selected.jabatan} · {selected.unit_kerja}</p>
                </div>
                <button
                  onClick={() => { setSelected(null); setPhotoData(null); stopCamera(); setStep("search"); }}
                  className="text-primary text-label-sm hover:underline flex-shrink-0"
                >
                  Ganti
                </button>
              </div>
            ) : (
              <div className="bg-secondary-container/40 border border-secondary-container rounded-xl p-3 mb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {getInitials(tamuNama)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label-md text-label-md text-on-surface leading-tight">{tamuNama}</p>
                  <p className="text-[11px] text-on-surface-variant">{tamuInstansi || "Tamu"} · Non-Anggota</p>
                </div>
                <button
                  onClick={() => { setPhotoData(null); stopCamera(); setStep("search"); }}
                  className="text-secondary text-label-sm hover:underline flex-shrink-0"
                >
                  Ganti
                </button>
              </div>
            )}

            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-900 mb-3">
              {photoData ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={photoData} alt="Selfie" className="w-full h-full object-cover" />
              ) : cameraErr ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
                  <span className="material-symbols-outlined text-[48px] mb-2">videocam_off</span>
                  <p className="text-body-sm">{cameraErr}</p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/70 rounded-tl-lg" />
                    <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/70 rounded-tr-lg" />
                    <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/70 rounded-bl-lg" />
                    <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/70 rounded-br-lg" />
                  </div>
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {!photoData ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPhotoData(null);
                    stopCamera();
                    if (presType === "anggota") setSelected(null);
                    setStep("search");
                  }}
                  className="px-4 py-3 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors text-label-md"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                <button
                  onClick={capturePhoto}
                  disabled={!!cameraErr}
                  className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-primary-container active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[22px]">photo_camera</span>
                  Ambil Foto
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  title="Lewati foto"
                  className="px-4 py-3 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors text-label-sm"
                >
                  Lewati
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={retakePhoto}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors text-label-md flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">refresh</span>
                  Ulang
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-[2] py-3 bg-primary text-on-primary rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-primary-container active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Mengirim...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[20px]">how_to_reg</span> Catat Kehadiran</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step: DONE */}
        {!isClosed && step === "done" && result && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-5">
            {result.type === "success" && (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-tertiary text-on-tertiary mb-3">
                  <span className="material-symbols-outlined material-symbols-filled text-[36px]">check_circle</span>
                </div>
                <h3 className="font-h3 text-h3 text-tertiary mb-1">Berhasil!</h3>
                <p className="text-body-md text-on-surface mb-4">Kehadiran Anda telah tercatat.</p>
                {result.foto && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={result.foto} alt="Selfie" className="w-32 h-32 mx-auto rounded-xl object-cover border-4 border-tertiary-fixed shadow-md mb-4" />
                )}
                <div className="bg-tertiary-fixed/40 border border-tertiary-fixed-dim rounded-xl p-3 text-left mb-4">
                  <p className="font-label-md text-on-surface">{result.nama}</p>
                  {result.jabatan && result.unit_kerja && (
                    <p className="text-[11px] text-on-surface-variant">{result.jabatan} · {result.unit_kerja}</p>
                  )}
                  {result.isTamu && (
                    <p className="text-[11px] text-secondary font-semibold mt-0.5">Tamu (Non-Anggota)</p>
                  )}
                </div>
              </div>
            )}
            {result.type === "duplicate" && (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary text-on-secondary mb-3">
                  <span className="material-symbols-outlined text-[36px]">info</span>
                </div>
                <h3 className="font-h3 text-h3 text-secondary mb-1">Sudah Tercatat</h3>
                <p className="text-body-md text-on-surface mb-4">
                  <strong>{result.nama}</strong> sudah hadir di kegiatan ini.
                </p>
              </div>
            )}
            {result.type === "error" && (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-error text-on-error mb-3">
                  <span className="material-symbols-outlined text-[36px]">error</span>
                </div>
                <h3 className="font-h3 text-h3 text-error mb-1">Gagal</h3>
                <p className="text-body-md text-on-surface mb-4">{result.msg}</p>
              </div>
            )}
            <button
              onClick={resetFlow}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-primary-container active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Catat Hadir Lainnya
            </button>
          </div>
        )}

        <p className="text-center text-label-sm text-on-surface-variant mt-6">
          Kode Acara: <span className="font-mono font-bold text-primary">{kegiatan.event_code}</span>
        </p>
      </div>
    </main>
  );
}
