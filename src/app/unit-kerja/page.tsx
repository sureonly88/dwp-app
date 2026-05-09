"use client";

import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface UnitKerja {
  id: number;
  kode: string;
  nama: string;
  deskripsi: string | null;
  aktif: number;
}

interface UnitFormData {
  kode: string;
  nama: string;
  deskripsi: string;
  aktif: number;
}

const EMPTY_FORM: UnitFormData = { kode: "", nama: "", deskripsi: "", aktif: 1 };

// ─── Modal Form ──────────────────────────────────────────────────────────────
function UnitModal({
  mode,
  initial,
  onClose,
  onSuccess,
}: {
  mode: "add" | "edit";
  initial?: UnitKerja;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<UnitFormData>(
    initial
      ? { kode: initial.kode, nama: initial.nama, deskripsi: initial.deskripsi ?? "", aktif: initial.aktif }
      : EMPTY_FORM
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === "aktif" ? Number(value) : value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = mode === "edit" && initial ? `/api/unit-kerja/${initial.id}` : "/api/unit-kerja";
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Terjadi kesalahan"); return; }
      onSuccess();
    } catch {
      setError("Gagal menyimpan data. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md border border-outline-variant">
        <div className="p-6 border-b border-outline-variant flex items-center justify-between">
          <div>
            <h2 className="font-h3 text-h3 text-on-surface">
              {mode === "add" ? "Tambah Unit Kerja" : "Edit Unit Kerja"}
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              {mode === "add" ? "Isi form untuk menambahkan unit kerja baru." : "Perbarui informasi unit kerja."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-error-container text-error rounded-lg text-body-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-label-md text-on-surface font-semibold">
              Kode Unit <span className="text-error">*</span>
            </label>
            <input
              name="kode"
              value={form.kode}
              onChange={handleChange}
              required
              placeholder="Contoh: SEKRETARIAT"
              className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-mono uppercase"
            />
            <p className="text-label-sm text-on-surface-variant">Kode unik, huruf besar tanpa spasi</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label-md text-on-surface font-semibold">
              Nama Unit Kerja <span className="text-error">*</span>
            </label>
            <input
              name="nama"
              value={form.nama}
              onChange={handleChange}
              required
              placeholder="Contoh: Sekretariat"
              className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label-md text-on-surface font-semibold">Deskripsi</label>
            <textarea
              name="deskripsi"
              value={form.deskripsi}
              onChange={handleChange}
              rows={2}
              placeholder="Keterangan singkat tentang unit kerja..."
              className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label-md text-on-surface font-semibold">Status</label>
            <select
              name="aktif"
              value={form.aktif}
              onChange={handleChange}
              style={{ paddingTop: "10px", paddingBottom: "10px" }}
              className="appearance-none border border-outline-variant rounded-lg px-4 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
            >
              <option value={1}>Aktif</option>
              <option value={0}>Non-Aktif</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-outline-variant text-on-surface font-label-md hover:bg-surface-container transition-colors">
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />}
              {mode === "add" ? "Tambah" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ name, loading, onConfirm, onCancel }: {
  name: string; loading: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm border border-outline-variant p-6 flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-error-container rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-error text-[20px]">delete_forever</span>
          </div>
          <div>
            <h3 className="font-h3 text-h3 text-on-surface">Hapus Unit Kerja?</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Unit Kerja <strong>&ldquo;{name}&rdquo;</strong> akan dihapus permanen. Pastikan tidak ada anggota yang menggunakan unit ini.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-5 py-2.5 rounded-lg border border-outline-variant text-on-surface font-label-md hover:bg-surface-container transition-colors">
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-error text-on-error font-label-md hover:bg-error/90 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-on-error/40 border-t-on-error rounded-full animate-spin" />}
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UnitKerjaPage() {
  const [data, setData] = useState<UnitKerja[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [editTarget, setEditTarget] = useState<UnitKerja | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnitKerja | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/unit-kerja");
      const json = await res.json();
      setData(json);
    } catch {
      showToast("Gagal memuat data unit kerja", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/unit-kerja/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Gagal menghapus", "error"); return; }
      showToast(`Unit Kerja "${deleteTarget.nama}" berhasil dihapus`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      showToast("Gagal menghapus data", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = data.filter((u) =>
    u.nama.toLowerCase().includes(search.toLowerCase()) ||
    u.kode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout searchPlaceholder="Cari unit kerja...">
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
        <UnitModal
          mode="add"
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); fetchData(); showToast("Unit Kerja berhasil ditambahkan"); }}
        />
      )}
      {modal === "edit" && editTarget && (
        <UnitModal
          mode="edit"
          initial={editTarget}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onSuccess={() => { setModal(null); setEditTarget(null); fetchData(); showToast("Unit Kerja berhasil diperbarui"); }}
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
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-h2 text-h2 text-primary">Setup Unit Kerja</h2>
            <p className="text-body-md text-on-surface-variant max-w-2xl mt-1">
              Kelola daftar unit kerja yang dapat dipilih saat mendaftarkan anggota.
            </p>
          </div>
          <Button icon="add" size="lg" onClick={() => setModal("add")}>
            Tambah Unit Kerja
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Total Unit</p>
            <h3 className="font-h1 text-[36px] text-primary leading-tight">{data.length}</h3>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Unit Aktif</p>
            <h3 className="font-h1 text-[36px] text-tertiary leading-tight">
              {data.filter((u) => u.aktif === 1).length}
            </h3>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Non-Aktif</p>
            <h3 className="font-h1 text-[36px] text-on-surface-variant leading-tight">
              {data.filter((u) => u.aktif === 0).length}
            </h3>
          </div>
        </div>

        {/* Table */}
        <Card>
          <div className="p-6 border-b border-outline-variant flex flex-wrap items-center justify-between gap-4">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau kode..."
                className="pl-9 pr-4 py-2.5 border border-outline-variant rounded-lg text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface min-w-[240px]"
              />
            </div>
            <span className="text-body-sm text-on-surface-variant">{filtered.length} unit kerja</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  {["Kode", "Nama Unit Kerja", "Deskripsi", "Status", "Aksi"].map((h) => (
                    <th key={h} className="px-6 py-4 font-label-md text-label-md text-on-surface-variant border-b border-outline-variant whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-surface-container-high rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-[48px] block mb-3 opacity-40">corporate_fare</span>
                      {search ? "Tidak ada unit kerja yang cocok" : "Belum ada unit kerja"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((unit) => (
                    <tr key={unit.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-label-sm bg-secondary-fixed text-on-secondary-fixed px-2.5 py-1 rounded-md">
                          {unit.kode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-label-md text-on-surface">{unit.nama}</span>
                      </td>
                      <td className="px-6 py-4 max-w-[280px]">
                        <span className="text-body-sm text-on-surface-variant line-clamp-2">
                          {unit.deskripsi ?? <span className="italic opacity-40">—</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={unit.aktif === 1 ? "success" : "neutral"} label={unit.aktif === 1 ? "Aktif" : "Non-Aktif"} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditTarget(unit); setModal("edit"); }}
                            className="p-2 rounded-lg text-on-surface-variant hover:bg-secondary-container hover:text-secondary transition-colors"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(unit)}
                            className="p-2 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                            title="Hapus"
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
        </Card>
      </div>
    </AppLayout>
  );
}
