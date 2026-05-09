"use client";

import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { FetchErrorRow } from "@/components/ui/FetchError";

interface Category {
  id: number;
  code: string;
  name: string;
  type: "income" | "expense";
  is_system: number;
  active: number;
  description: string | null;
}

const empty = { id: 0, code: "", name: "", type: "income" as "income" | "expense", description: "" };

export default function KasKategoriPage() {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true); setFetchError(false);
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      const res = await fetch(`/api/kas/kategori?${params}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();
      setData(json.data ?? []);
    } catch { setFetchError(true); } finally { setLoading(false); }
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(empty); setModal("add"); };
  const openEdit = (c: Category) => {
    setForm({ id: c.id, code: c.code, name: c.name, type: c.type, description: c.description ?? "" });
    setModal("edit");
  };

  const submit = async () => {
    if (!form.name.trim() || (modal === "add" && !form.code.trim())) {
      showToast("Kode dan nama wajib diisi", "error"); return;
    }
    setSubmitting(true);
    try {
      const url = modal === "add" ? "/api/kas/kategori" : `/api/kas/kategori/${form.id}`;
      const method = modal === "add" ? "POST" : "PUT";
      const body = modal === "add"
        ? { code: form.code, name: form.name, type: form.type, description: form.description }
        : { name: form.name, description: form.description, active: true };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(modal === "add" ? "Kategori ditambahkan" : "Kategori diperbarui");
      setModal(null); load();
    } catch (e) {
      showToast((e as Error).message ?? "Gagal", "error");
    } finally { setSubmitting(false); }
  };

  const remove = async (c: Category) => {
    if (!confirm(`Hapus kategori "${c.name}"?`)) return;
    try {
      const res = await fetch(`/api/kas/kategori/${c.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast("Kategori dihapus"); load();
    } catch (e) {
      showToast((e as Error).message ?? "Gagal hapus", "error");
    }
  };

  const toggleActive = async (c: Category) => {
    try {
      const res = await fetch(`/api/kas/kategori/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: c.name, description: c.description, active: c.active === 0 }),
      });
      if (!res.ok) throw new Error();
      load();
    } catch { showToast("Gagal memperbarui status", "error"); }
  };

  return (
    <AppLayout>
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg ${toast.type === "success" ? "bg-tertiary-container text-on-tertiary-container" : "bg-error-container text-error"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-h2 text-h2 text-primary">Kategori Kas</h2>
            <p className="text-body-sm text-on-surface-variant">Kelola kategori pemasukan & pengeluaran</p>
          </div>
          <button onClick={openAdd} className="px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md inline-flex items-center gap-2 hover:bg-primary-container">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tambah Kategori
          </button>
        </div>

        <Card>
          <div className="p-4 flex items-center gap-2 border-b border-outline-variant">
            {(["all","income","expense"] as const).map((t) => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-label-sm transition-colors ${filterType === t ? "bg-primary text-on-primary" : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"}`}>
                {t === "all" ? "Semua" : t === "income" ? "Pemasukan" : "Pengeluaran"}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                  <th className="px-6 py-3">Kode</th>
                  <th className="px-6 py-3">Nama</th>
                  <th className="px-6 py-3">Tipe</th>
                  <th className="px-6 py-3">Deskripsi</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {fetchError ? (
                  <FetchErrorRow colSpan={6} onRetry={load} />
                ) : loading ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">Memuat...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">Belum ada kategori.</td></tr>
                ) : data.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-container-low/50">
                    <td className="px-6 py-3 font-mono text-body-sm text-on-surface-variant">{c.code}</td>
                    <td className="px-6 py-3 font-label-md text-on-surface">{c.name}</td>
                    <td className="px-6 py-3"><Badge label={c.type === "income" ? "Pemasukan" : "Pengeluaran"} variant={c.type === "income" ? "success" : "error"} /></td>
                    <td className="px-6 py-3 text-body-sm text-on-surface-variant">{c.description ?? "-"}</td>
                    <td className="px-6 py-3">
                      {c.active ? <Badge label="Aktif" variant="info" dot /> : <Badge label="Nonaktif" variant="neutral" />}
                      {c.is_system === 1 && <span className="ml-2"><Badge label="Sistem" variant="warning" /></span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => toggleActive(c)} title={c.active ? "Nonaktifkan" : "Aktifkan"}
                          className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant">
                          <span className="material-symbols-outlined text-[18px]">{c.active ? "toggle_on" : "toggle_off"}</span>
                        </button>
                        <button onClick={() => openEdit(c)} title="Edit" className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        {c.is_system === 0 && (
                          <button onClick={() => remove(c)} title="Hapus" className="p-1.5 rounded-lg hover:bg-error-container text-error">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <Card className="w-full max-w-md p-6" hover={false}>
            <div onClick={(e) => e.stopPropagation()}>
              <h3 className="font-h3 text-h3 text-on-surface mb-4">{modal === "add" ? "Tambah" : "Edit"} Kategori</h3>
              <div className="flex flex-col gap-3">
                <label className="text-label-sm text-on-surface-variant">Kode
                  <input value={form.code} disabled={modal === "edit"} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="MIS_DONASI_KHUSUS"
                    className="mt-1 w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-50 font-mono" />
                </label>
                <label className="text-label-sm text-on-surface-variant">Nama
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
                </label>
                <label className="text-label-sm text-on-surface-variant">Tipe
                  <select value={form.type} disabled={modal === "edit"} onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })}
                    style={{ paddingTop: '10px', paddingBottom: '10px' }}
                    className="mt-1 appearance-none w-full px-3 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface disabled:opacity-50">
                    <option value="income">Pemasukan</option>
                    <option value="expense">Pengeluaran</option>
                  </select>
                </label>
                <label className="text-label-sm text-on-surface-variant">Deskripsi
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                    className="mt-1 w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
                </label>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container">Batal</button>
                <button onClick={submit} disabled={submitting} className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container disabled:opacity-50">
                  {submitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
