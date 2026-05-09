"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import KegiatanModal, { type KegiatanFormData } from "@/components/kegiatan/KegiatanModal";
import DeleteConfirm from "@/components/keanggotaan/DeleteConfirm";
import { FetchErrorRow } from "@/components/ui/FetchError";

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

interface ApiResponse {
  data: Kegiatan[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 10;

function formatTanggal(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
function formatJam(t: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

function statusVariant(s: Kegiatan["status"]) {
  switch (s) {
    case "Berlangsung": return "success" as const;
    case "Mendatang": return "info" as const;
    case "Selesai": return "neutral" as const;
    case "Dibatalkan": return "error" as const;
  }
}

export default function KegiatanPage() {
  const [data, setData] = useState<Kegiatan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKategori, setFilterKategori] = useState("");
  const [totalAnggota, setTotalAnggota] = useState<number>(0);

  // Calendar view
  const [view, setView] = useState<"list" | "calendar">("list");
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()); // 0-indexed
  const [calData, setCalData] = useState<Kegiatan[]>([]);
  const [calLoading, setCalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/anggota?status=Aktif&limit=1")
      .then((r) => r.json())
      .then((j) => setTotalAnggota(j.total ?? 0))
      .catch(() => {});
  }, []);

  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [editTarget, setEditTarget] = useState<(KegiatanFormData & { id: number }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Kegiatan | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams({
        search,
        status: filterStatus,
        kategori: filterKategori,
        page: String(page),
        limit: String(LIMIT),
      });
      const res = await fetch(`/api/kegiatan?${params}`);
      const json: ApiResponse = await res.json();
      setData(json.data);
      setTotal(json.total);
    } catch {
      setFetchError(true);
      showToast("Gagal memuat data kegiatan", "error");
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterKategori, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, filterStatus, filterKategori]);

  const fetchCalData = useCallback(async () => {
    setCalLoading(true);
    try {
      const firstDay = new Date(calYear, calMonth, 1).toISOString().split("T")[0];
      const lastDay = new Date(calYear, calMonth + 1, 0).toISOString().split("T")[0];
      const params = new URLSearchParams({ from: firstDay, to: lastDay, limit: "500" });
      const res = await fetch(`/api/kegiatan?${params}`);
      const json: ApiResponse = await res.json();
      setCalData(json.data);
    } catch {
      showToast("Gagal memuat data kalender", "error");
    } finally {
      setCalLoading(false);
    }
  }, [calYear, calMonth]);

  useEffect(() => { if (view === "calendar") fetchCalData(); }, [view, fetchCalData]);

  const handleEdit = (k: Kegiatan) => {
    setEditTarget({
      id: k.id,
      judul: k.judul,
      deskripsi: k.deskripsi ?? "",
      tanggal: k.tanggal?.split("T")[0] ?? "",
      waktu_mulai: k.waktu_mulai ?? "",
      waktu_selesai: k.waktu_selesai ?? "",
      lokasi: k.lokasi ?? "",
      kategori: k.kategori,
      status: k.status,
    });
    setModal("edit");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/kegiatan/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Kegiatan "${deleteTarget.judul}" dihapus`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      showToast("Gagal menghapus kegiatan", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const totalSelesai = data.filter((d) => d.status === "Selesai").length;
  const totalBerlangsung = data.filter((d) => d.status === "Berlangsung").length;
  const totalMendatang = data.filter((d) => d.status === "Mendatang").length;

  return (
    <AppLayout searchPlaceholder="Cari kegiatan...">
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

      {modal === "add" && (
        <KegiatanModal
          mode="add"
          onClose={() => setModal(null)}
          onSuccess={(msg) => { setModal(null); fetchData(); showToast(msg); }}
        />
      )}
      {modal === "edit" && editTarget && (
        <KegiatanModal
          mode="edit"
          initialData={editTarget}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onSuccess={(msg) => { setModal(null); setEditTarget(null); fetchData(); showToast(msg); }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.judul}
          loading={deleteLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-h2 text-h2 text-primary">Manajemen Kegiatan</h2>
            <p className="text-body-md text-on-surface-variant max-w-2xl mt-1">
              Kelola jadwal acara, cetak QR presensi, dan pantau kehadiran anggota secara real-time.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex rounded-lg border border-outline-variant overflow-hidden">
              <button
                onClick={() => setView("list")}
                className={`flex items-center gap-1.5 px-3 py-2 text-label-sm transition-colors ${view === "list" ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container"}`}
              >
                <span className="material-symbols-outlined text-[18px]">view_list</span>
                <span className="hidden sm:inline">Tabel</span>
              </button>
              <button
                onClick={() => setView("calendar")}
                className={`flex items-center gap-1.5 px-3 py-2 text-label-sm transition-colors ${view === "calendar" ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container"}`}
              >
                <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                <span className="hidden sm:inline">Kalender</span>
              </button>
            </div>
            <Button icon="event" size="lg" onClick={() => setModal("add")}>
              Buat Kegiatan
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatBox label="Total Kegiatan" value={total} icon="event" />
          <StatBox label="Berlangsung" value={totalBerlangsung} icon="play_circle" accent="tertiary" />
          <StatBox label="Mendatang" value={totalMendatang} icon="schedule" accent="primary" />
          <StatBox label="Selesai" value={totalSelesai} icon="check_circle" accent="neutral" />
        </div>

        {view === "calendar" ? (
          <CalendarView
            year={calYear}
            month={calMonth}
            events={calData}
            loading={calLoading}
            onPrev={() => {
              if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
              else setCalMonth((m) => m - 1);
            }}
            onNext={() => {
              if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
              else setCalMonth((m) => m + 1);
            }}
          />
        ) : (
        <Card>
          <div className="p-6 border-b border-outline-variant flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant">Cari</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Judul atau lokasi..."
                    className="pl-9 pr-4 py-2.5 border border-outline-variant rounded-lg text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface min-w-[220px]"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant">Status</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">tune</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="appearance-none pl-9 pr-8 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none min-w-[150px] text-on-surface"
                  >
                    <option value="">Semua Status</option>
                    <option>Mendatang</option>
                    <option>Berlangsung</option>
                    <option>Selesai</option>
                    <option>Dibatalkan</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">expand_more</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant">Kategori</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">category</span>
                  <select
                    value={filterKategori}
                    onChange={(e) => setFilterKategori(e.target.value)}
                    className="appearance-none pl-9 pr-8 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none min-w-[160px] text-on-surface"
                  >
                    <option value="">Semua Kategori</option>
                    <option>Rapat</option>
                    <option>Sosialisasi</option>
                    <option>Pelatihan</option>
                    <option>Arisan</option>
                    <option>Bakti Sosial</option>
                    <option>Lainnya</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">expand_more</span>
                </div>
              </div>
            </div>
            <span className="text-body-sm text-on-surface-variant">{total} kegiatan</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  {["Acara", "Tanggal & Waktu", "Lokasi", "Kategori", "Kehadiran", "Status", "Aksi"].map((h) => (
                    <th key={h} className="px-6 py-4 font-label-md text-label-md text-on-surface-variant border-b border-outline-variant whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-surface-container-high rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : fetchError ? (
                  <FetchErrorRow colSpan={7} message="Gagal memuat data kegiatan. Periksa koneksi dan coba lagi." onRetry={fetchData} />
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-on-surface-variant text-body-sm">
                      <span className="material-symbols-outlined text-[48px] block mb-3 opacity-30">event_busy</span>
                      Belum ada kegiatan. Klik &quot;Buat Kegiatan&quot; untuk memulai.
                    </td>
                  </tr>
                ) : (
                  data.map((k) => {
                    const persen = totalAnggota > 0 ? Math.min(100, Math.round((k.hadir_count / totalAnggota) * 100)) : 0;
                    return (
                      <tr key={k.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/kegiatan/${k.id}`} className="block">
                            <p className="font-label-md text-label-md text-on-surface hover:text-primary leading-tight">
                              {k.judul}
                            </p>
                            <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">#{k.event_code}</p>
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-body-sm text-on-surface-variant whitespace-nowrap">
                          <div>{formatTanggal(k.tanggal)}</div>
                          {k.waktu_mulai && (
                            <div className="text-[11px] mt-0.5">{formatJam(k.waktu_mulai)}{k.waktu_selesai ? ` – ${formatJam(k.waktu_selesai)}` : ""}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-body-sm text-on-surface">{k.lokasi || "-"}</td>
                        <td className="px-6 py-4">
                          <Badge label={k.kategori} variant="warning" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 min-w-[100px]">
                            <span className="text-label-sm font-semibold text-on-surface">
                              {k.hadir_count}{totalAnggota > 0 ? ` / ${totalAnggota}` : ""}
                              <span className="font-normal text-on-surface-variant"> anggota</span>
                            </span>
                            {totalAnggota > 0 && (
                              <div className="w-24 bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                                <div className="bg-primary h-full rounded-full" style={{ width: `${persen}%` }} />
                              </div>
                            )}
                            {k.tamu_count > 0 && (
                              <span className="text-[11px] text-secondary font-medium">{k.tamu_count} tamu</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge label={k.status} variant={statusVariant(k.status)} dot />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/kegiatan/${k.id}`}
                              title="Detail & Presensi"
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </Link>
                            <Link
                              href={`/kegiatan/${k.id}#qr`}
                              title="QR Presensi"
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                            </Link>
                            <button
                              onClick={() => handleEdit(k)}
                              title="Edit"
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit_square</span>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(k)}
                              title="Hapus"
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-outline-variant bg-surface-container-low flex items-center justify-between">
            <span className="text-body-sm text-on-surface-variant">
              Menampilkan {total === 0 ? 0 : Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} dari {total} kegiatan
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 border border-outline-variant rounded-lg bg-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_left</span>
              </button>
              <span className="text-body-sm text-on-surface px-2">{page} / {totalPages || 1}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 border border-outline-variant rounded-lg bg-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
              </button>
            </div>
          </div>
        </Card>
        )}
      </div>
    </AppLayout>
  );
}

function StatBox({ label, value, icon, accent = "primary" }: {
  label: string; value: number; icon: string; accent?: "primary" | "tertiary" | "neutral";
}) {
  const colors = {
    primary: "text-primary",
    tertiary: "text-tertiary",
    neutral: "text-on-surface-variant",
  };
  return (
    <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl">
      <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-end justify-between">
        <h3 className={`font-h1 text-[36px] leading-tight ${colors[accent]}`}>{value.toLocaleString("id-ID")}</h3>
        <span className={`material-symbols-outlined text-[28px] ${colors[accent]} opacity-70`}>{icon}</span>
      </div>
    </div>
  );
}

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const STATUS_CAL_COLOR: Record<string, string> = {
  Berlangsung: "bg-tertiary text-on-tertiary",
  Mendatang: "bg-primary text-on-primary",
  Selesai: "bg-surface-container-high text-on-surface-variant",
  Dibatalkan: "bg-error text-on-error",
};

function CalendarView({
  year, month, events, loading, onPrev, onNext,
}: {
  year: number;
  month: number;
  events: Kegiatan[];
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Build calendar grid (Sunday-first)
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay(); // 0=Sun

  const cells: Array<{ date: number; isCurrentMonth: boolean; isToday: boolean }> = [];
  // Leading empty days
  for (let i = 0; i < startOffset; i++) {
    const d = new Date(year, month, -startOffset + i + 1);
    cells.push({ date: d.getDate(), isCurrentMonth: false, isToday: false });
  }
  const today = new Date();
  for (let d = 1; d <= lastDate; d++) {
    cells.push({
      date: d,
      isCurrentMonth: true,
      isToday: today.getFullYear() === year && today.getMonth() === month && today.getDate() === d,
    });
  }
  // Trailing empty days to complete 6 rows
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: d, isCurrentMonth: false, isToday: false });
  }

  // Map events by date string
  const eventsByDate: Record<string, Kegiatan[]> = {};
  for (const e of events) {
    const dateKey = new Date(e.tanggal).toISOString().split("T")[0].split("-")[2].padStart(2, "0");
    if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
    eventsByDate[dateKey].push(e);
  }

  return (
    <Card>
      {/* Calendar header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <button
          onClick={onPrev}
          className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_left</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined material-symbols-filled text-primary text-[22px]">calendar_month</span>
          <h3 className="font-h3 text-h3 text-on-surface">
            {BULAN_ID[month]} {year}
          </h3>
          {loading && <span className="material-symbols-outlined animate-spin text-primary text-[18px]">progress_activity</span>}
        </div>
        <button
          onClick={onNext}
          className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-outline-variant bg-surface-container-low">
        {HARI_ID.map((h) => (
          <div key={h} className="text-center py-2.5 text-label-sm text-on-surface-variant font-semibold">
            {h}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const dayKey = String(cell.date).padStart(2, "0");
          const dayEvents = cell.isCurrentMonth ? (eventsByDate[dayKey] ?? []) : [];
          const showMore = dayEvents.length > 3;
          const visibleEvents = dayEvents.slice(0, 3);

          return (
            <div
              key={i}
              className={`min-h-[100px] border-r border-b border-outline-variant/30 p-1.5 flex flex-col gap-1 ${
                i % 7 === 6 ? "border-r-0" : ""
              } ${!cell.isCurrentMonth ? "bg-surface-container-lowest/50" : ""}`}
            >
              {/* Date number */}
              <div className="flex items-center justify-start mb-0.5">
                <span
                  className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full leading-none ${
                    cell.isToday
                      ? "bg-primary text-on-primary"
                      : cell.isCurrentMonth
                      ? "text-on-surface"
                      : "text-on-surface-variant/30"
                  }`}
                >
                  {cell.date}
                </span>
              </div>

              {/* Events */}
              {visibleEvents.map((e) => (
                <Link
                  key={e.id}
                  href={`/kegiatan/${e.id}`}
                  className={`block px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight truncate ${STATUS_CAL_COLOR[e.status] ?? "bg-surface-container text-on-surface"}`}
                  title={e.judul}
                >
                  {e.judul}
                </Link>
              ))}
              {showMore && (
                <span className="text-[10px] text-on-surface-variant px-1 font-medium">
                  +{dayEvents.length - 3} lagi
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-6 py-3 border-t border-outline-variant bg-surface-container-lowest">
        {Object.entries(STATUS_CAL_COLOR).map(([status, cls]) => (
          <span key={status} className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
            <span className={`w-3 h-3 rounded ${cls}`} />
            {status}
          </span>
        ))}
      </div>
    </Card>
  );
}
