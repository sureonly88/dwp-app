"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

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
  target_peserta: number | null;
  hadir_count: number;
  tamu_count: number;
}

interface PresensiItem {
  id: number;
  anggota_id: number;
  waktu_hadir: string;
  metode: "QR" | "Manual";
  catatan: string | null;
  foto: string | null;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
}

interface AnggotaSuggest {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
}

interface TamuItem {
  id: number;
  nama: string;
  instansi: string | null;
  keterangan: string | null;
  foto: string | null;
  waktu_hadir: string;
}

function formatTanggal(dateStr: string) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function formatJam(t: string | null) { return t ? t.slice(0, 5) : ""; }
function formatWaktuHadir(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function getInitials(nama: string) {
  return nama.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
function statusVariant(s: Kegiatan["status"]) {
  switch (s) {
    case "Berlangsung": return "success" as const;
    case "Mendatang": return "info" as const;
    case "Selesai": return "neutral" as const;
    case "Dibatalkan": return "error" as const;
  }
}

export default function KegiatanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [kegiatan, setKegiatan] = useState<Kegiatan | null>(null);
  const [loading, setLoading] = useState(true);
  const [presensi, setPresensi] = useState<PresensiItem[]>([]);
  const [searchHadir, setSearchHadir] = useState("");
  const [origin, setOrigin] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [hadirkanLoading, setHadirkanLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ src: string; nama: string } | null>(null);
  const [totalAnggota, setTotalAnggota] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Undangan
  const [undanganModal, setUndanganModal] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [undForm, setUndForm] = useState({
    nomor: "",
    penandatangan: "",
    jabatan_ttd: "Ketua",
    nip_ttd: "",
    kota: "Jakarta",
    catatan: "",
  });

  const [manualQuery, setManualQuery] = useState("");
  const [suggest, setSuggest] = useState<AnggotaSuggest[]>([]);
  const [adding, setAdding] = useState(false);

  const [tamu, setTamu] = useState<TamuItem[]>([]);
  const [tamuNama, setTamuNama] = useState("");
  const [tamuInstansi, setTamuInstansi] = useState("");
  const [addingTamu, setAddingTamu] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [addTab, setAddTab] = useState<"anggota" | "tamu">("anggota");

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [sseConnected, setSseConnected] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<number>>(new Set());

  // Tracks IDs already in state — used by SSE handler to deduplicate rows
  // that were already fetched by fetchPresensi() after a manual add.
  const seenPresensiIdsRef = useRef<Set<number>>(new Set());

  const fetchKegiatan = useCallback(async () => {
    try {
      const res = await fetch(`/api/kegiatan/${id}`);
      if (res.ok) setKegiatan(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchPresensi = useCallback(async () => {
    try {
      const params = new URLSearchParams({ search: searchHadir });
      const res = await fetch(`/api/kegiatan/${id}/presensi?${params}`);
      if (res.ok) {
        const json = await res.json();
        setPresensi(json.data);
        // Keep ref in sync so SSE won't re-add rows already loaded by this fetch
        seenPresensiIdsRef.current = new Set((json.data as PresensiItem[]).map((p) => p.id));
      }
    } catch {
      // silent
    }
  }, [id, searchHadir]);

  const fetchTamu = useCallback(async () => {
    try {
      const res = await fetch(`/api/kegiatan/${id}/presensi/tamu`);
      if (res.ok) {
        const json = await res.json();
        setTamu(json.data);
      }
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchKegiatan();
    fetchTamu();
    fetch("/api/anggota?status=Aktif&limit=1")
      .then((r) => r.json())
      .then((j) => setTotalAnggota(j.total ?? null))
      .catch(() => {});
    // Fetch top-ranking anggota for penandatangan
    const ROMAWI = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
    const RANK = ["Ketua","Wakil Ketua","Sekretaris","Bendahara","Pengurus"];
    fetch("/api/anggota?limit=100&page=1")
      .then((r) => r.json())
      .then((j) => {
        const sorted: { nama: string; nip: string; jabatan: string }[] = (j.data ?? []).sort(
          (a: { jabatan: string }, b: { jabatan: string }) => {
            const ai = RANK.indexOf(a.jabatan);
            const bi = RANK.indexOf(b.jabatan);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          }
        );
        if (sorted.length > 0) {
          const top = sorted[0];
          const now2 = new Date();
          setUndForm((prev) => ({
            ...prev,
            nomor: `001/DWP/${ROMAWI[now2.getMonth()]}/${now2.getFullYear()}`,
            penandatangan: top.nama,
            jabatan_ttd: top.jabatan,
            nip_ttd: top.nip,
          }));
        }
      })
      .catch(() => {});
  }, [fetchKegiatan, fetchTamu]);

  useEffect(() => {
    fetchPresensi();
  }, [fetchPresensi]);

  // Real-time presensi/tamu updates via Server-Sent Events
  useEffect(() => {
    const es = new EventSource(`/api/kegiatan/${id}/presensi/stream`);

    es.onopen = () => setSseConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "presensi" && Array.isArray(data.rows)) {
          const incoming: PresensiItem[] = (data.rows as PresensiItem[]).slice().reverse();
          // Deduplicate: skip rows already in state from a concurrent fetchPresensi() call
          const trulyNew = incoming.filter((r) => !seenPresensiIdsRef.current.has(r.id));
          if (trulyNew.length > 0) {
            trulyNew.forEach((r) => seenPresensiIdsRef.current.add(r.id));
            const newIds = trulyNew.map((r) => r.id);

            setPresensi((prev) => [...trulyNew, ...prev]);
            setKegiatan((prev) =>
              prev ? { ...prev, hadir_count: prev.hadir_count + trulyNew.length } : prev
            );

            // Flash-highlight new rows for 3 s
            setHighlightedIds((prev) => {
              const next = new Set([...prev, ...newIds]);
              setTimeout(() => {
                setHighlightedIds((cur) => {
                  const cleaned = new Set(cur);
                  newIds.forEach((rid) => cleaned.delete(rid));
                  return cleaned;
                });
              }, 3000);
              return next;
            });
          }
        }

        if (data.type === "tamu" && Array.isArray(data.rows)) {
          setTamu(data.rows as TamuItem[]);
          setKegiatan((prev) =>
            prev ? { ...prev, tamu_count: (data.rows as TamuItem[]).length } : prev
          );
        }

        if (data.type === "deleted" && Array.isArray(data.ids)) {
          const deletedSet = new Set<number>(data.ids as number[]);
          // Remove deleted IDs from ref so they can be re-added if re-inserted later
          (data.ids as number[]).forEach((rid) => seenPresensiIdsRef.current.delete(rid));
          setPresensi((prev) => prev.filter((p) => !deletedSet.has(p.id)));
          setKegiatan((prev) =>
            prev
              ? { ...prev, hadir_count: Math.max(0, prev.hadir_count - (data.ids as number[]).length) }
              : prev
          );
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => setSseConnected(false);

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [id]);

  // Anggota search suggestions for manual add
  useEffect(() => {
    if (!manualQuery.trim()) {
      setSuggest([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: manualQuery, limit: "8", page: "1" });
        const res = await fetch(`/api/anggota?${params}`);
        if (res.ok) {
          const json = await res.json();
          setSuggest(json.data ?? []);
        }
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [manualQuery]);

  const handleAddTamu = async () => {
    if (!tamuNama.trim()) return;
    setAddingTamu(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/presensi/tamu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: tamuNama.trim(),
          instansi: tamuInstansi.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Gagal mencatat tamu", "error");
      } else {
        showToast(`Kehadiran tamu ${tamuNama.trim()} tercatat`);
        setTamuNama("");
        setTamuInstansi("");
        fetchTamu();
      }
    } catch {
      showToast("Gagal mencatat kehadiran tamu", "error");
    } finally {
      setAddingTamu(false);
    }
  };

  const handleHapusTamu = async (tamuId: number, nama: string) => {
    if (!confirm(`Hapus tamu ${nama}?`)) return;
    try {
      const res = await fetch(`/api/kegiatan/${id}/presensi/tamu?tamu_id=${tamuId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Data tamu ${nama} dihapus`);
      fetchTamu();
    } catch {
      showToast("Gagal menghapus data tamu", "error");
    }
  };

  const handleAddManual = async (a: AnggotaSuggest) => {
    setAdding(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/presensi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anggota_id: a.id, metode: "Manual" }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Gagal mencatat", "error");
      } else {
        showToast(`Kehadiran ${a.nama} tercatat`);
        setManualQuery("");
        setSuggest([]);
        fetchPresensi();
        fetchKegiatan();
      }
    } catch {
      showToast("Gagal mencatat kehadiran", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleHapusPresensi = async (presensiId: number, nama: string) => {
    if (!confirm(`Hapus presensi ${nama}?`)) return;
    try {
      const res = await fetch(`/api/kegiatan/${id}/presensi?presensi_id=${presensiId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Presensi ${nama} dihapus`);
      fetchPresensi();
      fetchKegiatan();
    } catch {
      showToast("Gagal menghapus presensi", "error");
    }
  };

  const handleHadirkanSemua = async () => {
    if (!confirm("Catat semua anggota aktif sebagai hadir di kegiatan ini? Anggota yang sudah tercatat tidak akan digandakan.")) return;
    setHadirkanLoading(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/presensi`, { method: "PUT" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(json.message ?? "Semua anggota dicatat hadir");
      fetchPresensi();
      fetchKegiatan();
    } catch (e) {
      showToast((e as Error).message ?? "Gagal mencatat", "error");
    } finally {
      setHadirkanLoading(false);
    }
  };

  const handleHapusSemua = async () => {
    if (presensi.length === 0) return;
    if (!confirm(`Hapus SEMUA ${presensi.length} data presensi pada kegiatan ini? Tindakan ini tidak dapat dibatalkan.`)) return;
    setBulkDeleting(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/presensi?all=1`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(json.message ?? "Daftar hadir dikosongkan");
      setSelectedIds(new Set());
      fetchPresensi();
      fetchKegiatan();
    } catch {
      showToast("Gagal menghapus daftar hadir", "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleHapusTerpilih = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Hapus ${selectedIds.size} presensi terpilih?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        [...selectedIds].map((pid) =>
          fetch(`/api/kegiatan/${id}/presensi?presensi_id=${pid}`, { method: "DELETE" })
        )
      );
      showToast(`${selectedIds.size} presensi berhasil dihapus`);
      setSelectedIds(new Set());
      fetchPresensi();
      fetchKegiatan();
    } catch {
      showToast("Gagal menghapus presensi terpilih", "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (pid: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });

  const toggleSelectAll = () => {
    const ids = presensiFiltered.map((p) => p.id);
    const allChecked = ids.every((id) => selectedIds.has(id));
    setSelectedIds(allChecked ? new Set() : new Set(ids));
  };

  const exportCsv = () => {
    if (presensi.length === 0) return;
    const header = ["Waktu Hadir", "Nama", "NIP", "Jabatan", "Unit Kerja", "Metode"];
    const rows = presensi.map((p) => [
      new Date(p.waktu_hadir).toLocaleString("id-ID"),
      p.nama,
      p.nip,
      p.jabatan,
      p.unit_kerja,
      p.metode,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presensi-${kegiatan?.event_code ?? id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printQr = () => {
    if (!kegiatan) return;
    const qrUrl = `/api/kegiatan/${kegiatan.id}/qr`;
    const link = `${origin}/presensi/${kegiatan.event_code}`;
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>QR Presensi - ${kegiatan.judul}</title>
      <style>
        body{font-family:'Inter',Arial,sans-serif;text-align:center;padding:40px;color:#191c1d}
        h1{color:#6d181d;margin:0 0 8px;font-size:22px}
        h2{color:#6d181d;margin:0 0 20px;font-size:18px;font-weight:600}
        .meta{color:#564241;font-size:14px;margin-bottom:24px;line-height:1.6}
        .qr{display:inline-block;padding:16px;border:2px solid #6d181d;border-radius:16px;background:#fff}
        .qr img{display:block;width:320px;height:320px}
        .code{margin-top:16px;font-family:monospace;font-size:24px;letter-spacing:4px;color:#6d181d;font-weight:700}
        .url{margin-top:8px;font-size:12px;color:#564241;word-break:break-all}
        .ins{margin-top:24px;font-size:13px;color:#564241;max-width:400px;margin-left:auto;margin-right:auto;line-height:1.6}
        @media print{body{padding:20px}}
      </style></head><body>
      <h1>Presensi Dharma Wanita Persatuan</h1>
      <h2>${kegiatan.judul}</h2>
      <div class="meta">
        ${formatTanggal(kegiatan.tanggal)}<br/>
        ${kegiatan.waktu_mulai ? formatJam(kegiatan.waktu_mulai) : ""}${kegiatan.waktu_selesai ? " – " + formatJam(kegiatan.waktu_selesai) : ""}
        ${kegiatan.lokasi ? "<br/>" + kegiatan.lokasi : ""}
      </div>
      <div class="qr"><img src="${qrUrl}" alt="QR"/></div>
      <div class="code">${kegiatan.event_code}</div>
      <div class="url">${link}</div>
      <div class="ins">
        Pindai QR di atas dengan kamera ponsel Anda, lalu masukkan NIP untuk mencatat kehadiran.
      </div>
      <script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),300)});</script>
      </body></html>`);
    w.document.close();
  };

  const printUndangan = async () => {
    if (!kegiatan) return;
    setLoadingPdf(true);
    try {
      const res = await fetch(`/api/kegiatan/${kegiatan.id}/undangan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(undForm),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast((json as { error?: string }).error ?? "Gagal membuat PDF", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Tunda revoke agar tab sempat memuat PDF
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setUndanganModal(false);
      showToast("PDF undangan dibuka di tab baru");
    } catch {
      showToast("Gagal membuat PDF, coba lagi", "error");
    } finally {
      setLoadingPdf(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-on-surface-variant">
          <span className="material-symbols-outlined text-[28px] animate-spin mr-3">progress_activity</span>
          Memuat kegiatan...
        </div>
      </AppLayout>
    );
  }

  if (!kegiatan) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-[64px] text-on-surface-variant opacity-30 block mb-4">event_busy</span>
          <p className="text-on-surface-variant text-body-md">Kegiatan tidak ditemukan.</p>
          <Link href="/kegiatan" className="text-primary text-label-md mt-4 inline-block">← Kembali ke daftar kegiatan</Link>
        </div>
      </AppLayout>
    );
  }

  const totalAktif = totalAnggota ?? 0;
  const persen = totalAktif > 0 ? Math.min(100, Math.round((kegiatan.hadir_count / totalAktif) * 100)) : 0;
  const presensiFiltered = presensi.filter((p) =>
    !searchHadir || p.nama.toLowerCase().includes(searchHadir.toLowerCase()) || p.nip.includes(searchHadir)
  );
  const allChecked = presensiFiltered.length > 0 && presensiFiltered.every((p) => selectedIds.has(p.id));
  const someChecked = presensiFiltered.some((p) => selectedIds.has(p.id));

  return (
    <AppLayout>
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

      <div className="flex flex-col gap-6">
        {/* Breadcrumb + Header */}
        <div>
          <Link href="/kegiatan" className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-primary mb-3">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Kembali ke Daftar Kegiatan
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge label={kegiatan.kategori} variant="warning" />
                <Badge label={kegiatan.status} variant={statusVariant(kegiatan.status)} dot />
              </div>
              <h2 className="font-h2 text-h2 text-primary">{kegiatan.judul}</h2>
              {kegiatan.deskripsi && (
                <p className="text-body-md text-on-surface-variant max-w-2xl mt-1">{kegiatan.deskripsi}</p>
              )}
            </div>
            <div className="shrink-0">
              <button
                onClick={() => setUndanganModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary text-on-secondary rounded-xl font-label-md hover:bg-secondary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
                Cetak Undangan
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: QR + Info */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* QR Card */}
            <Card className="p-6" id="qr">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider">QR Presensi</h3>
                <span className="font-mono text-label-sm bg-primary-fixed text-on-primary-fixed-variant px-2 py-0.5 rounded">
                  #{kegiatan.event_code}
                </span>
              </div>
              <div className="bg-white border-2 border-primary rounded-xl p-4 flex items-center justify-center mb-4">
                {/* QR served from API (SVG) */}
                <img
                  src={`/api/kegiatan/${kegiatan.id}/qr`}
                  alt="QR Presensi"
                  className="w-full max-w-[260px] h-auto"
                />
              </div>
              <p className="text-body-sm text-on-surface-variant text-center mb-4">
                Anggota memindai QR ini lalu memasukkan NIP untuk mencatat kehadiran.
              </p>
              {origin && (
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded-lg mb-3 break-all">
                  <p className="text-[11px] text-on-surface-variant uppercase tracking-wider mb-1">Link Presensi</p>
                  <code className="text-body-sm text-primary">{origin}/presensi/{kegiatan.event_code}</code>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={printQr}
                  className="flex-1 py-2.5 bg-primary text-on-primary rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Cetak QR
                </button>
                <a
                  href={`/api/kegiatan/${kegiatan.id}/qr`}
                  download={`qr-${kegiatan.event_code}.svg`}
                  className="px-4 py-2.5 border border-outline-variant rounded-xl font-label-md text-on-surface-variant hover:bg-surface-container transition-colors flex items-center gap-2"
                  title="Unduh SVG"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                </a>
                <Link
                  href={`/presensi/${kegiatan.event_code}`}
                  target="_blank"
                  className="px-4 py-2.5 border border-outline-variant rounded-xl font-label-md text-on-surface-variant hover:bg-surface-container transition-colors flex items-center gap-2"
                  title="Buka halaman presensi"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                </Link>
              </div>
            </Card>

            {/* Event Info */}
            <Card className="p-6">
              <h3 className="font-label-md text-label-md text-on-surface-variant mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">info</span>
                Informasi Acara
              </h3>
              <div className="space-y-3 text-body-sm">
                <InfoRow icon="calendar_today" label="Tanggal" value={formatTanggal(kegiatan.tanggal)} />
                <InfoRow
                  icon="schedule"
                  label="Waktu"
                  value={kegiatan.waktu_mulai ? `${formatJam(kegiatan.waktu_mulai)}${kegiatan.waktu_selesai ? " – " + formatJam(kegiatan.waktu_selesai) : ""}` : "-"}
                />
                <InfoRow icon="location_on" label="Lokasi" value={kegiatan.lokasi || "-"} />
                <InfoRow icon="category" label="Kategori" value={kegiatan.kategori} />
              </div>
              <div className="pt-4 mt-4 border-t border-outline-variant">
                <div className="flex justify-between text-label-sm mb-2">
                  <span className="text-on-surface-variant">Kehadiran Anggota</span>
                  <span className="font-bold text-on-surface">
                      {kegiatan.hadir_count}{totalAktif > 0 ? ` / ${totalAktif}` : ""}
                    </span>
                  </div>
                  {totalAktif > 0 && (
                  <>
                    <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${persen}%` }} />
                    </div>
                    <p className="text-label-sm text-on-surface-variant mt-1.5 text-right">{persen}% hadir</p>
                  </>
                )}
                {(kegiatan.tamu_count > 0 || tamu.length > 0) && (
                  <div className="flex justify-between text-label-sm mt-3 pt-3 border-t border-outline-variant">
                    <span className="text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-secondary">person_outline</span>
                      Tamu Non-Anggota
                    </span>
                    <span className="font-bold text-secondary">{tamu.length > 0 ? tamu.length : kegiatan.tamu_count} orang</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Tambah Kehadiran */}
            <Card className="p-6">
              <h3 className="font-label-md text-label-md text-on-surface-variant mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">person_add</span>
                Tambah Kehadiran
              </h3>
              <p className="text-[11px] text-on-surface-variant mb-4">
                Catat kehadiran anggota DWP atau tamu non-anggota secara manual.
              </p>
              <button
                onClick={() => { setAddModal(true); setAddTab("anggota"); }}
                className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tambah Anggota / Tamu
              </button>
            </Card>
          </div>

          {/* RIGHT: Attendance List */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <Card>
              <div className="p-6 border-b border-outline-variant flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-h3 text-h3 text-on-surface">Daftar Hadir</h3>
                  {sseConnected ? (
                    <span className="inline-flex items-center gap-1.5 text-label-sm text-tertiary">
                      <span className="flex h-2 w-2 rounded-full bg-tertiary animate-pulse" />
                      Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant/60">
                      <span className="flex h-2 w-2 rounded-full bg-outline-variant" />
                      Menghubungkan...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                    <input
                      type="text"
                      value={searchHadir}
                      onChange={(e) => setSearchHadir(e.target.value)}
                      placeholder="Cari nama / NIP..."
                      className="pl-9 pr-4 py-2 border border-outline-variant rounded-lg text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface min-w-[220px]"
                    />
                  </div>
                  <button
                    onClick={handleHadirkanSemua}
                    disabled={hadirkanLoading || bulkDeleting}
                    title="Catat semua anggota aktif sebagai hadir sekaligus"
                    className="px-4 py-2 border border-tertiary/40 rounded-lg text-label-md text-tertiary hover:bg-tertiary-container/30 disabled:opacity-40 inline-flex items-center gap-2"
                  >
                    {hadirkanLoading ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">group_add</span>
                    )}
                    Hadirkan Semua
                  </button>
                  <button
                    onClick={exportCsv}
                    disabled={presensi.length === 0}
                    className="px-4 py-2 border border-outline-variant rounded-lg text-label-md text-on-surface-variant hover:bg-surface-container disabled:opacity-40 inline-flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Ekspor CSV
                  </button>
                  {selectedIds.size > 0 ? (
                    <button
                      onClick={handleHapusTerpilih}
                      disabled={bulkDeleting}
                      className="px-4 py-2 border border-error/30 rounded-lg text-label-md text-error hover:bg-error-container disabled:opacity-40 inline-flex items-center gap-2"
                    >
                      {bulkDeleting ? (
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      )}
                      Hapus {selectedIds.size} Terpilih
                    </button>
                  ) : (
                    <button
                      onClick={handleHapusSemua}
                      disabled={presensi.length === 0 || bulkDeleting}
                      title="Hapus seluruh daftar hadir"
                      className="px-4 py-2 border border-error/30 rounded-lg text-label-md text-error hover:bg-error-container disabled:opacity-40 inline-flex items-center gap-2"
                    >
                      {bulkDeleting ? (
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                      )}
                      Hapus Semua
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="px-4 py-4 border-b border-outline-variant w-10">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer"
                        />
                      </th>
                      {["#", "Foto", "Anggota", "NIP", "Unit Kerja", "Waktu", "Metode", ""].map((h, i) => (
                        <th key={i} className="px-6 py-4 font-label-md text-label-md text-on-surface-variant border-b border-outline-variant whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {presensiFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-16 text-center text-on-surface-variant text-body-sm">
                          <span className="material-symbols-outlined text-[48px] block mb-3 opacity-30">how_to_reg</span>
                          {presensi.length === 0
                            ? "Belum ada anggota yang melakukan presensi."
                            : "Tidak ada hasil sesuai pencarian."}
                        </td>
                      </tr>
                    ) : (
                      presensiFiltered.map((p, i) => (
                          <tr key={p.id} className={`transition-colors duration-700 ${selectedIds.has(p.id) ? "bg-primary-fixed/30" : highlightedIds.has(p.id) ? "bg-tertiary-container/40" : "hover:bg-surface-container-low/50"}`}>
                            <td className="px-4 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(p.id)}
                                onChange={() => toggleSelect(p.id)}
                                className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer"
                              />
                            </td>
                          <td className="px-6 py-3 text-body-sm text-on-surface-variant w-12">{i + 1}</td>
                          <td className="px-6 py-3">
                            {p.foto ? (
                              <button
                                onClick={() => setPhotoPreview({ src: p.foto!, nama: p.nama })}
                                title="Lihat foto selfie"
                                className="block w-12 h-12 rounded-lg overflow-hidden border border-outline-variant hover:border-primary transition-colors"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.foto} alt={`Selfie ${p.nama}`} className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                                <span className="material-symbols-outlined text-[18px]">image_not_supported</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {getInitials(p.nama)}
                              </div>
                              <div>
                                <p className="font-label-md text-label-md text-on-surface leading-tight">{p.nama}</p>
                                <p className="text-[11px] text-on-surface-variant">{p.jabatan}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3 font-mono text-body-sm text-on-surface-variant whitespace-nowrap">{p.nip}</td>
                          <td className="px-6 py-3 text-body-sm text-on-surface">{p.unit_kerja}</td>
                          <td className="px-6 py-3 text-body-sm text-on-surface-variant whitespace-nowrap">
                            {formatWaktuHadir(p.waktu_hadir)}
                          </td>
                          <td className="px-6 py-3">
                            <Badge
                              label={p.metode}
                              variant={p.metode === "QR" ? "info" : "warning"}
                            />
                          </td>
                          <td className="px-6 py-3">
                            <button
                              onClick={() => handleHapusPresensi(p.id, p.nama)}
                              title="Hapus presensi"
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Tamu (Non-Anggota) */}
            <Card>
              <div className="p-6 border-b border-outline-variant flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-h3 text-h3 text-on-surface">Tamu (Non-Anggota)</h3>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold bg-secondary-container text-on-secondary-container">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    Tidak ikut Arisan &amp; Doorprize
                  </span>
                </div>
                <span className="text-label-md text-on-surface-variant">{tamu.length} tamu</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low">
                      {["#", "Foto", "Nama Tamu", "Instansi / Asal", "Waktu Hadir", ""].map((h, i) => (
                        <th key={i} className="px-6 py-4 font-label-md text-label-md text-on-surface-variant border-b border-outline-variant whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {tamu.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant text-body-sm">
                          <span className="material-symbols-outlined text-[48px] block mb-3 opacity-30">groups</span>
                          Belum ada tamu yang dicatat.
                        </td>
                      </tr>
                    ) : (
                      tamu.map((t, i) => (
                        <tr key={t.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-6 py-3 text-body-sm text-on-surface-variant w-12">{i + 1}</td>
                          <td className="px-6 py-3">
                            {t.foto ? (
                              <button
                                onClick={() => setPhotoPreview({ src: t.foto!, nama: t.nama })}
                                title="Lihat foto selfie"
                                className="block w-12 h-12 rounded-lg overflow-hidden border border-outline-variant hover:border-secondary transition-colors"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={t.foto} alt={`Selfie ${t.nama}`} className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                                <span className="material-symbols-outlined text-[18px]">image_not_supported</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {getInitials(t.nama)}
                              </div>
                              <p className="font-label-md text-label-md text-on-surface">{t.nama}</p>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-body-sm text-on-surface-variant">{t.instansi ?? "-"}</td>
                          <td className="px-6 py-3 text-body-sm text-on-surface-variant whitespace-nowrap">
                            {formatWaktuHadir(t.waktu_hadir)}
                          </td>
                          <td className="px-6 py-3">
                            <button
                              onClick={() => handleHapusTamu(t.id, t.nama)}
                              title="Hapus tamu"
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { setAddModal(false); setManualQuery(""); setSuggest([]); }}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md border border-outline-variant flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-outline-variant flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-h3 text-h3 text-on-surface">Tambah Kehadiran</h2>
                <p className="text-body-sm text-on-surface-variant mt-0.5">{kegiatan?.judul}</p>
              </div>
              <button
                onClick={() => { setAddModal(false); setManualQuery(""); setSuggest([]); }}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-outline-variant flex-shrink-0">
              <button
                onClick={() => setAddTab("anggota")}
                className={`flex-1 py-3 text-label-md font-semibold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                  addTab === "anggota" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">badge</span>
                Anggota DWP
              </button>
              <button
                onClick={() => setAddTab("tamu")}
                className={`flex-1 py-3 text-label-md font-semibold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                  addTab === "tamu" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">person_outline</span>
                Tamu
              </button>
            </div>
            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1">
              {addTab === "anggota" ? (
                <div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">search</span>
                    <input
                      autoFocus
                      value={manualQuery}
                      onChange={(e) => setManualQuery(e.target.value)}
                      placeholder="Cari nama atau NIP anggota..."
                      className="w-full pl-9 pr-4 py-2.5 border border-outline-variant rounded-lg text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                    />
                  </div>
                  {manualQuery && suggest.length > 0 && (
                    <div className="mt-2 border border-outline-variant rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                      {suggest.map((a) => (
                        <button
                          key={a.id}
                          disabled={adding}
                          onClick={() => handleAddManual(a)}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low border-b border-outline-variant last:border-b-0 disabled:opacity-50 transition-colors"
                        >
                          <div className="font-label-md text-label-md text-on-surface">{a.nama}</div>
                          <div className="text-[11px] text-on-surface-variant font-mono">{a.nip} · {a.unit_kerja}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {manualQuery && !adding && suggest.length === 0 && (
                    <p className="text-body-sm text-on-surface-variant text-center mt-4 py-2">Tidak ada anggota ditemukan.</p>
                  )}
                  <p className="text-[11px] text-on-surface-variant mt-3">
                    Pilih anggota dari hasil pencarian untuk mencatat presensi secara manual.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2 p-3 bg-secondary-container/40 rounded-lg text-[11px] text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0 text-secondary">info</span>
                    Tamu <strong>tidak diikutsertakan</strong> dalam pengundian Arisan &amp; Doorprize.
                  </div>
                  <input
                    value={tamuNama}
                    onChange={(e) => setTamuNama(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTamu()}
                    placeholder="Nama tamu *"
                    className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  />
                  <input
                    value={tamuInstansi}
                    onChange={(e) => setTamuInstansi(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTamu()}
                    placeholder="Instansi / Asal (opsional)"
                    className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                  />
                  <button
                    onClick={handleAddTamu}
                    disabled={!tamuNama.trim() || addingTamu}
                    className="w-full py-2.5 bg-secondary text-on-secondary rounded-lg font-label-md flex items-center justify-center gap-2 hover:bg-secondary/90 disabled:opacity-50 transition-colors"
                  >
                    {addingTamu ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                    )}
                    Tambah Tamu
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {undanganModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg border border-outline-variant flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-outline-variant flex items-center justify-between">
              <div>
                <h2 className="font-h3 text-h3 text-on-surface">Cetak Undangan</h2>
                <p className="text-body-sm text-on-surface-variant mt-0.5">{kegiatan?.judul}</p>
              </div>
              <button onClick={() => setUndanganModal(false)} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">Nomor Surat</label>
                <input
                  type="text"
                  value={undForm.nomor}
                  onChange={(e) => setUndForm({ ...undForm, nomor: e.target.value })}
                  placeholder="001/DWP/V/2026"
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">Nama Penandatangan <span className="text-error">*</span></label>
                <input
                  type="text"
                  value={undForm.penandatangan}
                  onChange={(e) => setUndForm({ ...undForm, penandatangan: e.target.value })}
                  placeholder="Nama Ketua DWP"
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">Jabatan</label>
                  <input
                    type="text"
                    value={undForm.jabatan_ttd}
                    onChange={(e) => setUndForm({ ...undForm, jabatan_ttd: e.target.value })}
                    className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">NIP Penandatangan</label>
                  <input
                    type="text"
                    value={undForm.nip_ttd}
                    onChange={(e) => setUndForm({ ...undForm, nip_ttd: e.target.value })}
                    placeholder="(opsional)"
                    className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">Kota</label>
                <input
                  type="text"
                  value={undForm.kota}
                  onChange={(e) => setUndForm({ ...undForm, kota: e.target.value })}
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">Catatan Tambahan</label>
                <textarea
                  rows={3}
                  value={undForm.catatan}
                  onChange={(e) => setUndForm({ ...undForm, catatan: e.target.value })}
                  placeholder="Paragraf tambahan sebelum kalimat penutup (opsional)"
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface resize-none"
                />
              </div>
              <div className="p-3 bg-surface-container rounded-lg text-body-sm text-on-surface-variant flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">info</span>
                <span>Klik <strong>Unduh PDF</strong> untuk mengunduh file PDF surat undangan langsung ke perangkat Anda.</span>
              </div>
            </div>
            <div className="p-6 border-t border-outline-variant flex items-center justify-end gap-3 bg-surface-container">
              <button onClick={() => setUndanganModal(false)} className="px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container font-label-md">
                Batal
              </button>
              <button
                onClick={printUndangan}
                disabled={!undForm.penandatangan.trim() || loadingPdf}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loadingPdf ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    Membuat PDF...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Unduh PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {photoPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
              <p className="font-label-md text-label-md text-on-surface truncate">{photoPreview.nama}</p>
              <button
                onClick={() => setPhotoPreview(null)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview.src} alt={`Selfie ${photoPreview.nama}`} className="w-full h-auto block" />
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-on-surface-variant text-[18px] mt-0.5">{icon}</span>
      <div>
        <p className="text-[11px] text-on-surface-variant uppercase tracking-wider">{label}</p>
        <p className="text-on-surface">{value}</p>
      </div>
    </div>
  );
}
