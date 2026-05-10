"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import AnggotaModal, { type AnggotaFormData } from "@/components/keanggotaan/AnggotaModal";
import DeleteConfirm from "@/components/keanggotaan/DeleteConfirm";
import { FetchErrorRow } from "@/components/ui/FetchError";

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

export default function KeanggotaanPage() {
  const [data, setData] = useState<Anggota[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [unitOptions, setUnitOptions] = useState<UnitKerjaOption[]>([]);

  useEffect(() => {
    fetch("/api/unit-kerja")
      .then((r) => r.json())
      .then((data: UnitKerjaOption[]) => setUnitOptions(data.filter((u) => u.aktif === 1)))
      .catch(() => {});
  }, []);

  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [editTarget, setEditTarget] = useState<(AnggotaFormData & { id: number }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Anggota | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [fetchError, setFetchError] = useState(false);
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
        unit: filterUnit,
        page: String(page),
        limit: String(LIMIT),
      });
      const res = await fetch(`/api/anggota?${params}`);
      const json: ApiResponse = await res.json();
      setData(json.data);
      setTotal(json.total);
    } catch {
      setFetchError(true);
      showToast("Gagal memuat data anggota", "error");
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterUnit, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterUnit]);

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

      {modal === "add" && (
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
      {modal === "edit" && editTarget && (
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
      {deleteTarget && (
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
                {data.filter((a) => a.status === "Aktif").length}
              </h3>
            </div>
            {data.length > 0 && (
              <div className="w-full h-2 bg-tertiary-fixed rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-tertiary rounded-full transition-all"
                  style={{ width: `${(data.filter((a) => a.status === "Aktif").length / data.length) * 100}%` }}
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
            <Button variant="outline" icon="download">Ekspor Data</Button>
            <Button icon="person_add" size="lg" onClick={() => setModal("add")}>
              Tambah Anggota
            </Button>
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
                    onChange={(e) => setSearch(e.target.value)}
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
                    onChange={(e) => setFilterStatus(e.target.value)}
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
                    onChange={(e) => setFilterUnit(e.target.value)}
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
            </div>
            <span className="text-body-sm text-on-surface-variant">{total} anggota ditemukan</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  {["Nama Anggota", "NIP/ID", "Jabatan", "Unit Kerja", "Kontak", "Status", "Aksi"].map((h) => (
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
                  <FetchErrorRow colSpan={7} message="Gagal memuat data anggota. Periksa koneksi dan coba lagi." onRetry={fetchData} />
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-on-surface-variant text-body-sm">
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
