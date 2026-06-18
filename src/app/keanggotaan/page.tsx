"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import AnggotaModal, { type AnggotaFormData } from "@/components/keanggotaan/AnggotaModal";
import DeleteConfirm from "@/components/keanggotaan/DeleteConfirm";
import { FetchErrorRow } from "@/components/ui/FetchError";
import type { SessionUser } from "@/lib/auth-token";

interface Anggota {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: "Aktif" | "Non-Aktif" | "Cuti";
  no_hp: string | null;
  email: string | null;
  alamat: string | null;
  join_date: string;
  tanggal_keluar: string | null;
  tanggal_pensiun: string | null;
}

interface ApiResponse {
  data: Anggota[];
  total: number;
  page: number;
  limit: number;
}

interface UnitKerjaOption {
  id: number;
  nama: string;
  aktif: number;
}

interface ImportResponse {
  message?: string;
  error?: string;
  inserted?: number;
  updated?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
}

const LIMIT = 10;

function getInitials(nama: string) {
  return nama
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatJoinDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

function formatTanggal(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function KeanggotaanPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<Anggota[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [totalAktif, setTotalAktif] = useState(0);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterJenis, setFilterJenis] = useState<"" | "pengurus" | "anggota">("");
  const [unitOptions, setUnitOptions] = useState<UnitKerjaOption[]>([]);

  const updateSearch = (value: string) => { setSearch(value); setPage(1); };
  const updateStatus = (value: string) => { setFilterStatus(value); setPage(1); };
  const updateUnit = (value: string) => { setFilterUnit(value); setPage(1); };
  const updateJenis = (value: "" | "pengurus" | "anggota") => { setFilterJenis(value); setPage(1); };

  useEffect(() => {
    fetch("/api/unit-kerja")
      .then((r) => r.json())
      .then((data: UnitKerjaOption[]) => setUnitOptions(data.filter((u) => u.aktif === 1)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/anggota?status=Aktif&limit=1")
      .then((r) => r.json())
      .then((json: { total?: number }) => setTotalAktif(json.total ?? 0))
      .catch(() => setTotalAktif(0));
  }, []);

  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [editTarget, setEditTarget] = useState<(AnggotaFormData & { id: number }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Anggota | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [fetchError, setFetchError] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const isAdmin = currentUser?.role === "admin";

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
        unit: filterUnit,
        jenis: filterJenis,
        page: String(page),
        limit: String(LIMIT),
      });
      const res = await fetch(`/api/anggota?${params}`);
      const json: ApiResponse = await res.json();
      setData(json.data ?? []);
      setTotal(json.total);
    } catch {
      setFetchError(true);
      showToast("Gagal memuat data anggota", "error");
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterUnit, filterJenis, page]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => setCurrentUser(json?.user ?? null))
      .catch(() => setCurrentUser(null));
  }, []);

  const handleEdit = (anggota: Anggota) => {
    setEditTarget({
      id: anggota.id,
      nama: anggota.nama,
      nip: anggota.nip,
      jabatan: anggota.jabatan,
      unit_kerja: anggota.unit_kerja,
      status: anggota.status,
      no_hp: anggota.no_hp ?? "",
      email: anggota.email ?? "",
      alamat: anggota.alamat ?? "",
      join_date: anggota.join_date?.split("T")[0] ?? "",
      tanggal_keluar: anggota.tanggal_keluar ? anggota.tanggal_keluar.split("T")[0] : "",
      tanggal_pensiun: anggota.tanggal_pensiun ? anggota.tanggal_pensiun.split("T")[0] : "",
    });
    setModal("edit");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/anggota/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`${deleteTarget.nama} berhasil dihapus`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      showToast("Gagal menghapus anggota", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/anggota/import", {
        method: "POST",
        body: formData,
      });
      const json: ImportResponse = await res.json();

      if (!res.ok) {
        const detail = json.errors?.length ? ` (${json.errors.slice(0, 3).map((err) => `baris ${err.row}: ${err.message}`).join("; ")})` : "";
        throw new Error(`${json.error ?? "Gagal mengimport data anggota"}${detail}`);
      }

      const inserted = json.inserted ?? 0;
      const updated = json.updated ?? 0;
      const skipped = json.skipped ?? 0;
      showToast(`Import selesai: ${inserted} ditambah, ${updated} diperbarui${skipped ? `, ${skipped} dilewati` : ""}`);
      setPage(1);
      fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal mengimport data anggota", "error");
    } finally {
      setImporting(false);
    }
  };

  const downloadImportTemplate = () => {
    const header = ["nama", "nip", "jabatan", "unit_kerja", "status", "no_hp", "email", "alamat", "join_date", "tanggal_keluar", "tanggal_pensiun"];
    const sample = ["Ibu Siti Aminah", "198205122010012001", "Anggota", "Sekretariat", "Aktif", "08123456789", "siti@example.com", "Alamat lengkap", new Date().toISOString().slice(0, 10), "", ""];
    const csv = [header, sample].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-import-anggota.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportData = () => {
    const params = new URLSearchParams();

    if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    if (filterUnit) params.set("unit", filterUnit);
    if (filterJenis) params.set("jenis", filterJenis);

    window.location.href = `/api/anggota/export?${params.toString()}`;
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AppLayout searchPlaceholder="Cari anggota atau NIP...">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg font-label-md text-label-md transition-all ${
            toast.type === "success"
              ? "bg-tertiary-container text-on-tertiary-container border border-tertiary-fixed-dim"
              : "bg-error-container text-error border border-error/30"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      {isAdmin && modal === "add" && (
        <AnggotaModal
          mode="add"
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null);
            fetchData();
            showToast("Anggota berhasil ditambahkan");
          }}
        />
      )}
      {isAdmin && modal === "edit" && editTarget && (
        <AnggotaModal
          mode="edit"
          initialData={editTarget}
          onClose={() => {
            setModal(null);
            setEditTarget(null);
          }}
          onSuccess={() => {
            setModal(null);
            setEditTarget(null);
            fetchData();
            showToast("Data anggota berhasil diperbarui");
          }}
        />
      )}
      {isAdmin && deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.nama}
          loading={deleteLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="flex flex-col gap-8">
        <div>
          <div>
            <h2 className="font-h2 text-h2 text-primary">Manajemen Keanggotaan</h2>
            <p className="text-body-md text-on-surface-variant max-w-2xl mt-1">
              Kelola data seluruh anggota Dharma Wanita Persatuan dengan sistematis.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Total Anggota</p>
            <div className="flex items-end justify-between">
              <h3 className="font-h1 text-[36px] text-primary leading-tight">{total.toLocaleString("id-ID")}</h3>
              <span className="flex items-center text-tertiary font-label-sm mb-2">
                <span className="material-symbols-outlined text-[16px] mr-1">groups</span>
                Terdaftar
              </span>
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Anggota Aktif</p>
            <div className="flex items-end justify-between gap-4">
              <h3 className="font-h1 text-[36px] text-on-tertiary-fixed-variant leading-tight">
                {totalAktif}
              </h3>
            </div>
            {data.length > 0 && (
              <div className="w-full h-2 bg-tertiary-fixed rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-tertiary rounded-full transition-all"
                  style={{ width: `${total > 0 ? (totalAktif / total) * 100 : 0}%` }}
                />
              </div>
            )}
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Anggota Non-Aktif</p>
            <div className="flex items-end justify-between gap-4">
              <h3 className="font-h1 text-[36px] text-error leading-tight">
                {data.filter((a) => a.status === "Non-Aktif").length}
              </h3>
            </div>
            {data.length > 0 && (
              <div className="w-full h-2 bg-error-container rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-error rounded-full transition-all"
                  style={{ width: `${(data.filter((a) => a.status === "Non-Aktif").length / data.length) * 100}%` }}
                />
              </div>
            )}
          </div>
          <div className="col-span-2 lg:col-span-1 flex flex-wrap items-center justify-start lg:justify-end gap-3">
            {isAdmin && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <Button variant="outline" icon="upload_file" disabled={importing} onClick={() => importInputRef.current?.click()}>
                  {importing ? "Mengimport..." : "Import Excel"}
                </Button>
              </>
            )}
            <Button variant="ghost" icon="description" onClick={downloadImportTemplate}>
              Template
            </Button>
            <Button variant="outline" icon="download" onClick={handleExportData} disabled={loading || total === 0}>
              Ekspor Data
            </Button>
            {isAdmin && (
              <Button icon="person_add" size="lg" onClick={() => setModal("add")}>
                Tambah Anggota
              </Button>
            )}
          </div>
        </div>

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
                    onChange={(e) => updateSearch(e.target.value)}
                    placeholder="Nama atau NIP..."
                    className="pl-9 pr-4 py-2.5 border border-outline-variant rounded-lg text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface min-w-[200px]"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant">Status</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">tune</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => updateStatus(e.target.value)}
                    className="appearance-none pl-9 pr-8 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px] text-on-surface"
                  >
                    <option value="">Semua Status</option>
                    <option>Aktif</option>
                    <option>Non-Aktif</option>
                    <option>Cuti</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">expand_more</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant">Unit Kerja</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">corporate_fare</span>
                  <select
                    value={filterUnit}
                    onChange={(e) => updateUnit(e.target.value)}
                    className="appearance-none pl-9 pr-8 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px] text-on-surface"
                  >
                    <option value="">Semua Unit</option>
                    {unitOptions.map((u) => (
                      <option key={u.id} value={u.nama}>{u.nama}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">expand_more</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant">Jenis</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">groups</span>
                  <select
                    value={filterJenis}
                    onChange={(e) => updateJenis(e.target.value as "" | "pengurus" | "anggota")}
                    className="appearance-none pl-9 pr-8 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[150px] text-on-surface"
                  >
                    <option value="">Semua</option>
                    <option value="pengurus">Pengurus</option>
                    <option value="anggota">Anggota</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">expand_more</span>
                </div>
              </div>
            </div>
            <span className="text-body-sm text-on-surface-variant">{total} anggota ditemukan</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  {["Nama Anggota", "NIP/ID", "Jabatan", "Unit Kerja", "Tanggal Pensiun", "Kontak", "Status", "Aksi"].filter((h) => isAdmin || h !== "Aksi").map((h) => (
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
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-surface-container-high rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : fetchError ? (
                  <FetchErrorRow colSpan={8} message="Gagal memuat data anggota. Periksa koneksi dan coba lagi." onRetry={fetchData} />
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-on-surface-variant text-body-sm">
                      <span className="material-symbols-outlined text-[48px] block mb-3 opacity-30">person_search</span>
                      Tidak ada data anggota yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  data.map((anggota) => (
                    <tr key={anggota.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {getInitials(anggota.nama)}
                          </div>
                          <div>
                            <p className="font-label-md text-label-md text-on-surface leading-tight">{anggota.nama}</p>
                            <p className="text-[11px] text-on-surface-variant">Bergabung: {formatJoinDate(anggota.join_date)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-body-sm text-on-surface-variant whitespace-nowrap">{anggota.nip}</td>
                      <td className="px-6 py-4 text-body-sm text-on-surface">{anggota.jabatan}</td>
                      <td className="px-6 py-4 text-body-sm text-on-surface">{anggota.unit_kerja}</td>
                      <td className="px-6 py-4 text-body-sm text-on-surface-variant whitespace-nowrap">{formatTanggal(anggota.tanggal_pensiun)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          {anggota.no_hp && (
                            <span className="text-body-sm text-on-surface-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">phone</span>
                              {anggota.no_hp}
                            </span>
                          )}
                          {anggota.email && (
                            <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">mail</span>
                              {anggota.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          label={anggota.status}
                          variant={anggota.status === "Aktif" ? "success" : anggota.status === "Cuti" ? "warning" : "neutral"}
                          dot
                        />
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/keanggotaan/${anggota.id}`}
                              title="Lihat Profil"
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">person</span>
                            </Link>
                            <button
                              onClick={() => handleEdit(anggota)}
                              title="Edit"
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit_square</span>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(anggota)}
                              title="Hapus"
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-outline-variant bg-surface-container-low flex items-center justify-between">
            <span className="text-body-sm text-on-surface-variant">
              Menampilkan {total === 0 ? 0 : Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} dari {total} anggota
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 border border-outline-variant rounded-lg bg-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_left</span>
              </button>
              <span className="text-body-sm text-on-surface px-2">
                {page} / {totalPages || 1}
              </span>
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
      </div>
    </AppLayout>
  );
}
