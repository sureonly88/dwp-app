"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { StatusKeanggotaan } from "@/lib/anggota-options";

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
  status_keanggotaan: StatusKeanggotaan;
}

interface AnggotaSuggest {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  no_hp: string | null;
}

interface UnitKerjaOption {
  id: number;
  nama: string;
  aktif?: number;
}

interface TamuItem {
  id: number;
  nama: string;
  instansi: string | null;
  keterangan: string | null;
  foto: string | null;
  waktu_hadir: string;
}

const PRESENSI_PAGE_SIZE = 5;
const PRESENSI_GROUP_ORDER = ["Istri Karyawan", "Karyawati", "Pengurus", "tamu"] as const satisfies readonly (StatusKeanggotaan | "tamu")[];
type PresensiSelectionKey = `anggota:${number}` | `tamu:${number}`;

const INITIAL_ANGGOTA_PAGES: Record<StatusKeanggotaan, number> = {
  "Istri Karyawan": 1,
  Karyawati: 1,
  Pengurus: 1,
};

function formatTanggal(dateStr: string) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function formatJam(t: string | null) { return t ? t.slice(0, 5) : ""; }
function formatWaktuHadir(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function matchesPresensiSearch(item: PresensiItem, query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;
  return item.nama.toLowerCase().includes(keyword) || item.nip.includes(query.trim());
}
function withCurrentUnitKerja(options: UnitKerjaOption[], current: string) {
  const unitKerja = current.trim();
  if (!unitKerja || options.some((option) => option.nama === unitKerja)) return options;
  return [{ id: -1, nama: unitKerja, aktif: 1 }, ...options];
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
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const [kegiatan, setKegiatan] = useState<Kegiatan | null>(null);
  const [loading, setLoading] = useState(true);
  const [presensi, setPresensi] = useState<PresensiItem[]>([]);
  const [searchHadir, setSearchHadir] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [hadirkanLoading, setHadirkanLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ src: string; nama: string } | null>(null);
  const [totalAnggota, setTotalAnggota] = useState<number | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<PresensiSelectionKey>>(new Set());
  const [anggotaPages, setAnggotaPages] = useState<Record<StatusKeanggotaan, number>>(INITIAL_ANGGOTA_PAGES);
  const [tamuPage, setTamuPage] = useState(1);

  const [manualQuery, setManualQuery] = useState("");
  const [manualSelected, setManualSelected] = useState<AnggotaSuggest | null>(null);
  const [manualNoHp, setManualNoHp] = useState("");
  const [manualUnitKerja, setManualUnitKerja] = useState("");
  const [unitOptions, setUnitOptions] = useState<UnitKerjaOption[]>([]);
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

  const resetManualAnggota = () => {
    setManualQuery("");
    setManualSelected(null);
    setManualNoHp("");
    setManualUnitKerja("");
    setSuggest([]);
  };

  useEffect(() => {
    fetch("/api/unit-kerja")
      .then((r) => r.json())
      .then((data: UnitKerjaOption[]) => setUnitOptions(Array.isArray(data) ? data : []))
      .catch(() => setUnitOptions([]));
  }, []);

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
    fetchKegiatan();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Pemanggilan fetch awal halaman tetap mengikuti pola existing page.
    fetchTamu();
    fetch("/api/anggota?status=Aktif&limit=1")
      .then((r) => r.json())
      .then((j) => setTotalAnggota(j.total ?? null))
      .catch(() => {});
  }, [fetchKegiatan, fetchTamu]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Pemanggilan fetch awal halaman tetap mengikuti pola existing page.
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
    if (!manualQuery.trim() || manualSelected) {
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
  }, [manualQuery, manualSelected]);

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

  const handleSelectManual = (a: AnggotaSuggest) => {
    setManualSelected(a);
    setManualQuery(a.nama);
    setManualNoHp(a.no_hp ?? "");
    setManualUnitKerja(a.unit_kerja);
    setSuggest([]);
  };

  const handleAddManual = async () => {
    if (!manualSelected) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/presensi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anggota_id: manualSelected.id,
          metode: "Manual",
          no_hp: manualNoHp.trim() || undefined,
          unit_kerja: manualUnitKerja.trim() || manualSelected.unit_kerja,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Gagal mencatat", "error");
      } else {
        showToast(`Kehadiran ${manualSelected.nama} tercatat`);
        resetManualAnggota();
        fetchPresensi();
        fetchKegiatan();
      }
    } catch {
      showToast("Gagal mencatat kehadiran", "error");
    } finally {
      setAdding(false);
    }
  };

  const hapusPresensi = async (key: PresensiSelectionKey) => {
    const [jenis, rowId] = key.split(":");
    const path = jenis === "tamu" ? `/tamu?tamu_id=${rowId}` : `?presensi_id=${rowId}`;
    const res = await fetch(`/api/kegiatan/${id}/presensi${path}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Gagal menghapus presensi");
  };

  const handleHapusPresensi = async (key: PresensiSelectionKey, nama: string) => {
    if (bulkDeleting || !confirm(`Hapus presensi ${nama}?`)) return;
    setBulkDeleting(true);
    try {
      await hapusPresensi(key);
      setSelectedKeys((prev) => new Set([...prev].filter((selectedKey) => selectedKey !== key)));
      showToast(`Presensi ${nama} dihapus`);
      await Promise.allSettled([key.startsWith("tamu:") ? fetchTamu() : fetchPresensi(), fetchKegiatan()]);
    } catch {
      showToast("Gagal menghapus presensi", "error");
    } finally {
      setBulkDeleting(false);
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
    if (!confirm("Hapus semua presensi anggota dari seluruh status keanggotaan pada kegiatan ini? Tindakan ini tidak dapat dibatalkan.")) return;
    setBulkDeleting(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/presensi?all=1`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(json.message ?? "Daftar hadir dikosongkan");
      setSelectedKeys(new Set());
      fetchPresensi();
      fetchKegiatan();
    } catch {
      showToast("Gagal menghapus daftar hadir", "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleHapusTerpilih = async () => {
    const keys = [...selectedKeys];
    if (keys.length === 0 || bulkDeleting) return;
    if (!confirm(`Hapus ${keys.length} presensi terpilih?`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(keys.map(hapusPresensi));
    const deletedKeys = new Set(keys.filter((_, index) => results[index].status === "fulfilled"));
    const failedCount = keys.length - deletedKeys.size;
    setSelectedKeys((prev) => new Set([...prev].filter((key) => !deletedKeys.has(key))));
    if (failedCount > 0) {
      showToast(
        deletedKeys.size === 0
          ? "Gagal menghapus presensi terpilih"
          : `${deletedKeys.size} presensi dihapus. ${failedCount} gagal dihapus.`,
        "error"
      );
    } else {
      showToast(`${deletedKeys.size} presensi berhasil dihapus`);
    }
    await Promise.allSettled([fetchPresensi(), fetchTamu(), fetchKegiatan()]);
    setBulkDeleting(false);
  };

  const toggleSelection = (keys: PresensiSelectionKey[]) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (keys.every((key) => prev.has(key))) {
        keys.forEach((key) => next.delete(key));
      } else {
        keys.forEach((key) => next.add(key));
      }
      return next;
    });
  };

  const exportCsv = () => {
    if (presensi.length === 0) return;
    const header = ["Waktu Hadir", "Nama", "NIP", "Jabatan", "Unit Kerja", "Status Keanggotaan", "Metode"];
    const rows = presensi.map((p) => [
      new Date(p.waktu_hadir).toLocaleString("id-ID"),
      p.nama,
      p.nip,
      p.jabatan,
      p.unit_kerja,
      p.status_keanggotaan,
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
        Pindai QR di atas dengan kamera ponsel Anda, lalu masukkan NIP atau nama suami untuk mencatat kehadiran.
      </div>
      <script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),300)});</script>
      </body></html>`);
    w.document.close();
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
  const presensiFiltered = presensi.filter((p) => matchesPresensiSearch(p, searchHadir));
  const presensiGroups = PRESENSI_GROUP_ORDER.map((status) => {
    const isTamu = status === "tamu";
    const items = isTamu ? tamu : presensiFiltered.filter((item) => item.status_keanggotaan === status);
    const totalPages = Math.max(1, Math.ceil(items.length / PRESENSI_PAGE_SIZE));
    const currentPage = Math.min(isTamu ? tamuPage : anggotaPages[status], totalPages);
    const startIndex = (currentPage - 1) * PRESENSI_PAGE_SIZE;
    const pageItems = items.slice(startIndex, startIndex + PRESENSI_PAGE_SIZE);
    const jenis = isTamu ? "tamu" : "anggota";

    return {
      status,
      jenis,
      label: isTamu ? "Daftar Hadir Tamu" : status,
      sectionId: `presensi-${status.toLowerCase().replace(/\s+/g, "-")}`,
      count: items.length,
      currentPage,
      pageItems,
      pageKeys: pageItems.map((item) => `${jenis}:${item.id}` as const),
    };
  });
  const visiblePresensiKeys = presensiGroups.flatMap((group) => group.pageKeys);

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

      <div className="-mx-6 flex flex-col gap-6 sm:mx-0">
        {/* Breadcrumb + Header */}
        <div>
          <Link href="/kegiatan" className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-primary mb-3">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Kembali ke Daftar Kegiatan
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Badge label={kegiatan.kategori} variant="warning" />
            <Badge label={kegiatan.status} variant={statusVariant(kegiatan.status)} dot />
          </div>
          <h2 className="font-h2 text-h2 text-primary">{kegiatan.judul}</h2>
          {kegiatan.deskripsi && (
            <p className="text-body-md text-on-surface-variant max-w-2xl mt-1">{kegiatan.deskripsi}</p>
          )}
        </div>

        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
          <Card className="min-w-0 p-5 sm:p-6" id="qr">
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
              Anggota memindai QR ini lalu memasukkan NIP atau nama suami untuk mencatat kehadiran.
            </p>
            {origin && (
              <div className="p-3 bg-surface-container-low border border-outline-variant rounded-lg mb-3 break-all">
                <p className="text-[11px] text-on-surface-variant uppercase tracking-wider mb-1">Link Presensi</p>
                <code className="text-body-sm text-primary">{origin}/presensi/{kegiatan.event_code}</code>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={printQr}
                className="flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-2 py-2.5 font-label-md text-on-primary transition-colors hover:bg-primary-container"
              >
                <span aria-hidden="true" className="material-symbols-outlined size-5 overflow-hidden text-[18px]">print</span>
                Cetak QR
              </button>
              <a
                href={`/api/kegiatan/${kegiatan.id}/qr`}
                download={`qr-${kegiatan.event_code}.svg`}
                className="inline-flex size-11 items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container"
                title="Unduh SVG"
                aria-label="Unduh QR sebagai SVG"
              >
                <span aria-hidden="true" className="material-symbols-outlined size-5 overflow-hidden text-[18px]">download</span>
              </a>
              <Link
                href={`/presensi/${kegiatan.event_code}`}
                target="_blank"
                className="inline-flex size-11 items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container"
                title="Buka halaman presensi"
                aria-label="Buka halaman presensi"
              >
                <span aria-hidden="true" className="material-symbols-outlined size-5 overflow-hidden text-[18px]">open_in_new</span>
              </Link>
            </div>
          </Card>

          <div className="flex min-w-0 flex-col gap-5">
            <Card className="min-w-0 p-5 sm:p-6">
              <h3 className="mb-5 flex items-center gap-2 text-body-lg font-semibold text-on-surface">
                <span aria-hidden="true" className="material-symbols-outlined size-5 shrink-0 overflow-hidden text-[20px] text-secondary">info</span>
                Informasi Acara
              </h3>
              <div className="grid gap-4 text-body-sm lg:grid-cols-2">
                <InfoRow icon="calendar_today" label="Tanggal" value={formatTanggal(kegiatan.tanggal)} />
                <InfoRow
                  icon="schedule"
                  label="Waktu"
                  value={kegiatan.waktu_mulai ? `${formatJam(kegiatan.waktu_mulai)}${kegiatan.waktu_selesai ? " – " + formatJam(kegiatan.waktu_selesai) : ""}` : "-"}
                />
                <InfoRow icon="location_on" label="Lokasi" value={kegiatan.lokasi || "-"} />
                <InfoRow icon="category" label="Kategori" value={kegiatan.kategori} />
              </div>
              <div className="mt-6 border-t border-outline-variant pt-5">
                <div className="mb-2 flex justify-between gap-2 text-body-sm">
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
                      <span aria-hidden="true" className="material-symbols-outlined size-4 shrink-0 overflow-hidden text-[14px] text-secondary">person_outline</span>
                      Tamu Non-Anggota
                    </span>
                    <span className="font-bold text-secondary">{tamu.length > 0 ? tamu.length : kegiatan.tamu_count} orang</span>
                  </div>
                )}
              </div>
            </Card>

            <Card className="min-w-0 p-5 sm:p-6">
              <h3 className="mb-3 flex items-center gap-2 text-body-lg font-semibold text-on-surface">
                <span aria-hidden="true" className="material-symbols-outlined size-5 shrink-0 overflow-hidden text-[20px] text-secondary">person_add</span>
                Tambah Kehadiran
              </h3>
              <button
                onClick={() => { resetManualAnggota(); setAddModal(true); setAddTab("anggota"); }}
                className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-primary-container transition-colors"
              >
                <span aria-hidden="true" className="material-symbols-outlined size-5 overflow-hidden text-[18px]">add</span>
                Tambah Anggota / Tamu
              </button>
            </Card>
          </div>
        </div>

        <Card id="daftar-hadir" className="@container min-w-0 overflow-hidden">
          <div className="p-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-h3 text-h3 text-on-surface">Daftar Hadir Anggota</h3>
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
          </div>
          <div className="space-y-3 border-t border-outline-variant px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full @md:flex-1">
                <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 overflow-hidden text-on-surface-variant text-[18px]">search</span>
                <input
                  type="search"
                  aria-label="Cari anggota berdasarkan nama atau NIP"
                  value={searchHadir}
                  onChange={(e) => {
                    setSearchHadir(e.target.value);
                    setAnggotaPages(INITIAL_ANGGOTA_PAGES);
                  }}
                  placeholder="Cari nama / NIP..."
                  className="min-h-10 w-full rounded-lg border border-outline-variant bg-surface py-2 pr-3 pl-9 text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-body-sm text-on-surface-variant has-disabled:opacity-50">
                <PresensiCheckbox
                  label="Pilih yang tampil"
                  keys={visiblePresensiKeys}
                  selected={selectedKeys}
                  disabled={bulkDeleting}
                  onToggle={toggleSelection}
                />
                Pilih yang tampil
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleHadirkanSemua}
                disabled={hadirkanLoading || bulkDeleting}
                title="Catat semua anggota aktif sebagai hadir sekaligus"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-tertiary/40 px-3 py-2 text-label-md text-tertiary hover:bg-tertiary-container/30 disabled:opacity-40"
              >
                {hadirkanLoading ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">group_add</span>
                )}
                Hadirkan Semua Anggota
              </button>
              <button
                onClick={exportCsv}
                disabled={presensi.length === 0}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-label-md text-on-surface-variant hover:bg-surface-container disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Ekspor CSV Anggota
              </button>
              {selectedKeys.size > 0 ? (
                <button
                  onClick={handleHapusTerpilih}
                  disabled={bulkDeleting}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-error/30 px-3 py-2 text-label-md text-error hover:bg-error-container disabled:opacity-40"
                >
                  {bulkDeleting ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  )}
                  Hapus {selectedKeys.size} Terpilih
                </button>
              ) : (
                <button
                  onClick={handleHapusSemua}
                  disabled={presensi.length === 0 || bulkDeleting}
                  title="Hapus daftar hadir anggota dari semua status keanggotaan"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-error/30 px-3 py-2 text-label-md text-error hover:bg-error-container disabled:opacity-40"
                >
                  {bulkDeleting ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                  )}
                  Hapus Semua Presensi Anggota
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-outline-variant p-3 sm:p-4 @lg:grid-cols-2 @4xl:grid-cols-4">
            {presensiGroups.map((group) => (
              <section key={group.status} id={group.sectionId} aria-labelledby={`${group.sectionId}-title`} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-outline-variant">
                <div className="flex min-h-18 shrink-0 items-start gap-2.5 border-b border-outline-variant bg-surface-container-low px-3 py-3">
                  <div className="flex h-5 items-center">
                    <PresensiCheckbox
                      label={`Pilih yang tampil di ${group.label}`}
                      keys={group.pageKeys}
                      selected={selectedKeys}
                      disabled={bulkDeleting}
                      onToggle={toggleSelection}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 id={`${group.sectionId}-title`} className="wrap-anywhere text-body-md leading-tight font-semibold text-on-surface">{group.label}</h4>
                    <p className="mt-1 text-sm text-on-surface-variant tabular-nums">{group.count} {group.jenis}</p>
                  </div>
                </div>
                {group.count === 0 ? (
                  <p className="px-3 py-4 text-body-sm text-on-surface-variant">
                    {group.jenis === "tamu"
                      ? "Belum ada tamu yang dicatat."
                      : searchHadir.trim() ? "Tidak ada anggota yang cocok dengan pencarian." : "Belum ada anggota yang tercatat hadir."}
                  </p>
                ) : (
                  <ul className="divide-y divide-outline-variant">
                    {group.pageItems.map((p, index) => {
                      const key = group.pageKeys[index];
                      const isAnggota = "anggota_id" in p;

                      return (
                        <li
                          key={key}
                          className={`grid grid-cols-[1.75rem_minmax(0,1fr)_2rem] items-start gap-x-2 gap-y-1 px-2.5 py-3 transition-colors duration-700 ${selectedKeys.has(key)
                            ? "bg-primary-fixed/30"
                            : isAnggota && highlightedIds.has(p.id) ? "bg-tertiary-container/40" : "hover:bg-surface-container-low/50"
                          }`}
                        >
                          <div className="col-start-1 row-span-2 row-start-1 flex flex-col items-center gap-1">
                            <div className="flex h-8 items-center">
                              <PresensiCheckbox
                                label={`Pilih ${p.nama}`}
                                keys={[key]}
                                selected={selectedKeys}
                                disabled={bulkDeleting}
                                onToggle={toggleSelection}
                              />
                            </div>
                            {p.foto ? (
                              <button
                                onClick={() => setPhotoPreview({ src: p.foto!, nama: p.nama })}
                                aria-label={`Lihat selfie ${p.nama}`}
                                className="size-7 shrink-0 overflow-hidden rounded-md border border-outline-variant transition-colors hover:border-primary"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.foto} alt="" className="size-full object-cover" />
                              </button>
                            ) : (
                              <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-container text-on-surface-variant">
                                <span className="material-symbols-outlined size-5 overflow-hidden text-[20px]">person</span>
                              </span>
                            )}
                          </div>
                          <p className="col-start-2 row-start-1 min-w-0 self-center wrap-anywhere text-body-md leading-snug font-semibold text-on-surface">{p.nama}</p>
                          <div className="col-span-2 col-start-2 row-start-2 min-w-0 wrap-anywhere text-body-sm text-on-surface-variant">
                            {isAnggota && p.nip && <p className="text-sm tabular-nums">{p.nip}</p>}
                            <p>{isAnggota ? p.unit_kerja : p.instansi ?? "Instansi tidak diisi"}</p>
                            {isAnggota && p.jabatan && <p className="text-sm">{p.jabatan}</p>}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <time dateTime={p.waktu_hadir.replace(" ", "T")} className="text-sm tabular-nums">{formatWaktuHadir(p.waktu_hadir)}</time>
                              {isAnggota && <Badge label={p.metode} variant={p.metode === "QR" ? "info" : "warning"} />}
                            </div>
                          </div>
                          <button
                            onClick={() => handleHapusPresensi(key, p.nama)}
                            disabled={bulkDeleting}
                            aria-label={`Hapus ${isAnggota ? "presensi" : "tamu"} ${p.nama}`}
                            className="col-start-3 row-start-1 inline-flex size-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-error disabled:opacity-40"
                          >
                            <span aria-hidden="true" className="material-symbols-outlined size-5 overflow-hidden text-[20px]">delete</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <PresensiPagination
                  label={group.label}
                  itemLabel={group.jenis}
                  totalItems={group.count}
                  currentPage={group.currentPage}
                  onPageChange={(page) => {
                    if (group.status === "tamu") {
                      setTamuPage(page);
                    } else {
                      setAnggotaPages((prev) => ({ ...prev, [group.status]: page }));
                    }
                  }}
                />
              </section>
            ))}
          </div>
        </Card>
      </div>

      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { setAddModal(false); resetManualAnggota(); }}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md border border-outline-variant flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-outline-variant flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-h3 text-h3 text-on-surface">Tambah Kehadiran</h2>
                <p className="text-body-sm text-on-surface-variant mt-0.5">{kegiatan?.judul}</p>
              </div>
              <button
                onClick={() => { setAddModal(false); resetManualAnggota(); }}
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
                      onChange={(e) => {
                        const value = e.target.value;
                        setManualQuery(value);
                        setManualSelected(null);
                        setManualNoHp("");
                        setManualUnitKerja("");
                        if (!value.trim()) setSuggest([]);
                      }}
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
                          onClick={() => handleSelectManual(a)}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low border-b border-outline-variant last:border-b-0 disabled:opacity-50 transition-colors"
                        >
                          <div className="font-label-md text-label-md text-on-surface">{a.nama}</div>
                          <div className="text-[11px] text-on-surface-variant font-mono">{a.nip} · {a.unit_kerja}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {manualQuery && !manualSelected && !adding && suggest.length === 0 && (
                    <p className="text-body-sm text-on-surface-variant text-center mt-4 py-2">Tidak ada anggota ditemukan.</p>
                  )}
                  {manualSelected && (
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="bg-primary-fixed/30 border border-primary-fixed-dim rounded-lg p-3">
                        <p className="font-label-md text-label-md text-on-surface">{manualSelected.nama}</p>
                        <p className="text-[11px] text-on-surface-variant">{manualSelected.jabatan} · {manualSelected.unit_kerja}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">{manualSelected.nip}</p>
                      </div>
                      <div>
                        <label className="text-label-sm text-on-surface-variant mb-1 block">Unit kerja anggota</label>
                        <select
                          value={manualUnitKerja}
                          onChange={(e) => setManualUnitKerja(e.target.value)}
                          className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                        >
                          {withCurrentUnitKerja(unitOptions, manualUnitKerja || manualSelected.unit_kerja).map((option) => (
                            <option key={`${option.id}-${option.nama}`} value={option.nama}>
                              {option.nama}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-label-sm text-on-surface-variant mb-1 block">
                          No. telepon anggota <span className="text-on-surface-variant">(opsional)</span>
                        </label>
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={manualNoHp}
                          onChange={(e) => setManualNoHp(e.target.value)}
                          maxLength={20}
                          placeholder="08xxxxxxxxxx"
                          className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                        />
                      </div>
                      <button
                        onClick={handleAddManual}
                        disabled={adding}
                        className="w-full py-2.5 bg-primary text-on-primary rounded-lg font-label-md flex items-center justify-center gap-2 hover:bg-primary-container disabled:opacity-50 transition-colors"
                      >
                        {adding ? (
                          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                        )}
                        Simpan Kehadiran
                      </button>
                    </div>
                  )}
                  {!manualSelected && (
                    <p className="text-[11px] text-on-surface-variant mt-3">
                      Pilih anggota dari hasil pencarian untuk mengisi unit kerja dan mencatat presensi secara manual.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2 p-3 bg-secondary-container/40 rounded-lg text-[11px] text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0 text-secondary">info</span>
                    Tamu dapat diikutsertakan dalam <strong>Doorprize</strong> jika hadir, tetapi <strong>tidak ikut Arisan</strong>.
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

function PresensiCheckbox({ label, keys, selected, disabled, onToggle }: {
  label: string;
  keys: PresensiSelectionKey[];
  selected: ReadonlySet<PresensiSelectionKey>;
  disabled: boolean;
  onToggle: (keys: PresensiSelectionKey[]) => void;
}) {
  const checked = keys.length > 0 && keys.every((key) => selected.has(key));
  const indeterminate = !checked && keys.some((key) => selected.has(key));

  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(input) => { if (input) input.indeterminate = indeterminate; }}
      disabled={disabled || keys.length === 0}
      onChange={() => onToggle(keys)}
      className="size-4 shrink-0 cursor-pointer rounded border-outline-variant accent-primary disabled:cursor-default disabled:opacity-50"
    />
  );
}

function PresensiPagination({ label, itemLabel, totalItems, currentPage, onPageChange }: {
  label: string;
  itemLabel: string;
  totalItems: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / PRESENSI_PAGE_SIZE);
  if (totalPages < 2) return null;

  const firstItem = (currentPage - 1) * PRESENSI_PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * PRESENSI_PAGE_SIZE, totalItems);
  const buttonClass = "min-h-9 min-w-0 rounded-md border border-outline-variant bg-surface-container-lowest px-1 text-sm text-on-surface-variant hover:bg-surface-container disabled:opacity-40";

  return (
    <nav aria-label={`Halaman ${label}`} className="mt-auto space-y-2 border-t border-outline-variant bg-surface-container-low px-2.5 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-sm text-on-surface-variant tabular-nums">{firstItem}–{lastItem} dari {totalItems} {itemLabel}</p>
        <div className="relative min-w-0">
          <select
            aria-label={`Pilih halaman untuk ${label}`}
            value={currentPage}
            onChange={(event) => onPageChange(Number(event.target.value))}
            className="min-h-8 appearance-none rounded-md border border-outline-variant bg-surface-container-lowest py-1 pr-7 pl-2 text-sm text-on-surface"
          >
            {Array.from({ length: totalPages }, (_, index) => (
              <option key={index + 1} value={index + 1}>Hal. {index + 1}</option>
            ))}
          </select>
          <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 size-4 -translate-y-1/2 overflow-hidden text-[16px] text-on-surface-variant">expand_more</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label={`Halaman sebelumnya untuk ${label}`}
          className={buttonClass}
        >
          Sebelumnya
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label={`Halaman berikutnya untuk ${label}`}
          className={buttonClass}
        >
          Berikutnya
        </button>
      </div>
    </nav>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="material-symbols-outlined mt-0.5 size-5 shrink-0 overflow-hidden text-[18px] text-on-surface-variant">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="wrap-anywhere font-medium text-on-surface">{value}</p>
      </div>
    </div>
  );
}
