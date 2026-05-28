"use client";

import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { FetchErrorRow } from "@/components/ui/FetchError";

interface Trx {
  id: number; transaction_number: string; transaction_date: string;
  type: "income" | "expense"; category_id: number; category_name: string; category_code: string;
  amount: number | string; payment_method: string; description: string | null;
  reference_number: string | null; status: "draft" | "pending" | "approved" | "rejected" | "cancelled";
  source_type: string | null; source_id: string | null;
  created_by_username: string | null; approved_by_username: string | null;
}
interface Category { id: number; code: string; name: string; type: "income" | "expense" }
interface Me { id: number; username: string; nama: string; role: "admin" | string }

const fmt = (n: number | string) => {
  const x = typeof n === "string" ? Number(n) : n;
  return "Rp " + (x ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
};
const today = () => new Date().toISOString().slice(0, 10);
const PAY_METHODS = ["Tunai", "Transfer", "QRIS", "Lainnya"] as const;

const emptyForm = {
  id: 0, transaction_date: today(), type: "expense" as "income" | "expense",
  category_id: 0, amount: "", payment_method: "Tunai" as string, description: "", reference_number: "",
};

export default function KasTransaksiPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [data, setData] = useState<Trx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [search, setSearch] = useState("");

  // Modal
  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((j) => setMe(j.user)).catch(() => {});
    // Read URL ?status=pending (from dashboard link)
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("status");
    if (s) {
      const timeout = window.setTimeout(() => setFilterStatus(s), 0);
      return () => window.clearTimeout(timeout);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/kas/kategori?active=1");
    if (res.ok) {
      const j = await res.json(); setCategories(j.data ?? []);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setFetchError(false);
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (search) params.set("search", search);
      params.set("limit", "200");
      const res = await fetch(`/api/kas/transaksi?${params}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();
      setData(json.data ?? []);
    } catch { setFetchError(true); } finally { setLoading(false); }
  }, [filterType, filterStatus, filterFrom, filterTo, search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadCategories(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadCategories]);
  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const filteredCategories = categories.filter((c) => c.type === form.type && c.code !== "IURAN_ANGGOTA" && c.code !== "IURAN_PENGURUS" && c.code !== "PENJUALAN_BARANG");

  const openAdd = () => { setForm(emptyForm); setModal("add"); };
  const openEdit = (t: Trx) => {
    setForm({
      id: t.id, transaction_date: t.transaction_date, type: t.type,
      category_id: t.category_id, amount: String(t.amount),
      payment_method: t.payment_method, description: t.description ?? "", reference_number: t.reference_number ?? "",
    });
    setModal("edit");
  };

  const submit = async () => {
    const amount = Number(form.amount);
    if (!form.category_id || !Number.isFinite(amount) || amount <= 0) {
      showToast("Lengkapi kategori dan nominal", "error"); return;
    }
    setSubmitting(true);
    try {
      const url = modal === "add" ? "/api/kas/transaksi" : `/api/kas/transaksi/${form.id}`;
      const method = modal === "add" ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        transaction_date: form.transaction_date, type: form.type, category_id: form.category_id,
        amount, payment_method: form.payment_method,
        description: form.description, reference_number: form.reference_number,
      })});
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(modal === "add" ? "Transaksi dibuat (menunggu persetujuan)" : "Transaksi diperbarui");
      setModal(null); load();
    } catch (e) {
      showToast((e as Error).message ?? "Gagal", "error");
    } finally { setSubmitting(false); }
  };

  const approve = async (t: Trx, action: "approve" | "reject" | "cancel") => {
    const labels = { approve: "menyetujui", reject: "menolak", cancel: "membatalkan" };
    if (!confirm(`Yakin ${labels[action]} transaksi ${t.transaction_number}?`)) return;
    try {
      const res = await fetch(`/api/kas/transaksi/${t.id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(`Transaksi ${action === "approve" ? "disetujui" : action === "reject" ? "ditolak" : "dibatalkan"}`);
      load();
    } catch (e) { showToast((e as Error).message ?? "Gagal", "error"); }
  };

  const remove = async (t: Trx) => {
    if (!confirm(`Hapus transaksi ${t.transaction_number}?`)) return;
    try {
      const res = await fetch(`/api/kas/transaksi/${t.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast("Transaksi dihapus"); load();
    } catch (e) { showToast((e as Error).message ?? "Gagal", "error"); }
  };

  const exportCsv = () => {
    if (data.length === 0) return;
    const header = ["No", "Nomor", "Tanggal", "Tipe", "Kategori", "Nominal", "Metode", "Deskripsi", "No. Referensi", "Status", "Sumber"];
    const rows = data.map((t, i) => [
      String(i + 1), t.transaction_number, t.transaction_date,
      t.type === "income" ? "Pemasukan" : "Pengeluaran",
      t.category_name, String(t.amount), t.payment_method,
      t.description ?? "", t.reference_number ?? "", t.status,
      t.source_type ?? "manual",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `transaksi-kas-${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (s: Trx["status"]) => {
    const variant = s === "approved" ? "success" : s === "pending" ? "warning" : s === "rejected" || s === "cancelled" ? "error" : "neutral";
    const label = { approved: "Disetujui", pending: "Menunggu", rejected: "Ditolak", cancelled: "Dibatalkan", draft: "Draft" }[s];
    return <Badge label={label} variant={variant} />;
  };

  const canApprove = me?.role === "admin" || me?.role === "operator";

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
            <h2 className="font-h2 text-h2 text-primary">Transaksi Kas</h2>
            <p className="text-body-sm text-on-surface-variant">Catat dan setujui transaksi pemasukan & pengeluaran</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={data.length === 0} className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-xl font-label-md inline-flex items-center gap-2 hover:bg-surface-container disabled:opacity-40">
              <span className="material-symbols-outlined text-[18px]">download</span> Ekspor CSV
            </button>
            <button onClick={openAdd} className="px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md inline-flex items-center gap-2 hover:bg-primary-container">
              <span className="material-symbols-outlined text-[18px]">add</span> Tambah Transaksi
            </button>
          </div>
        </div>

        <Card>
          <div className="p-4 flex flex-wrap items-center gap-2 border-b border-outline-variant">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as "all"|"income"|"expense")}
              style={{ paddingTop: '10px', paddingBottom: '10px' }}
              className="appearance-none border border-outline-variant rounded-lg px-3 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface">
              <option value="all">Semua Tipe</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              style={{ paddingTop: '10px', paddingBottom: '10px' }}
              className="appearance-none border border-outline-variant rounded-lg px-3 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface">
              <option value="">Semua Status</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
              <option value="cancelled">Dibatalkan</option>
              <option value="draft">Draft</option>
            </select>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
              className="px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-body-sm" />
            <span className="text-on-surface-variant">→</span>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
              className="px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-body-sm" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor / deskripsi..."
              className="flex-1 min-w-[180px] px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-body-sm" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                  <th className="px-4 py-3">Nomor</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3">Deskripsi</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {fetchError ? (
                  <FetchErrorRow colSpan={9} onRetry={load} />
                ) : loading ? (
                  <tr><td colSpan={9} className="px-6 py-12 text-center text-on-surface-variant">Memuat...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] block mb-2 opacity-30">receipt_long</span>
                    Belum ada transaksi sesuai filter.
                  </td></tr>
                ) : data.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low/50 text-body-sm">
                    <td className="px-4 py-3 font-mono text-[12px]">{t.transaction_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{t.transaction_date}</td>
                    <td className="px-4 py-3">
                      <span className={`material-symbols-outlined text-[18px] ${t.type === "income" ? "text-tertiary" : "text-error"}`}>
                        {t.type === "income" ? "arrow_downward" : "arrow_upward"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{t.category_name}
                      {t.source_type && t.source_type !== "manual" && (
                        <div className="text-[10px] text-on-surface-variant mt-0.5 uppercase">via {t.source_type}</div>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-label-md whitespace-nowrap ${t.type === "income" ? "text-tertiary" : "text-error"}`}>
                      {fmt(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{t.payment_method}</td>
                    <td className="px-4 py-3 text-on-surface-variant max-w-[260px] truncate">{t.description ?? "-"}</td>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {t.status === "pending" && canApprove && (
                        <>
                          <button onClick={() => approve(t, "approve")} title="Setujui" className="p-1.5 rounded-lg hover:bg-tertiary-container text-tertiary">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          </button>
                          <button onClick={() => approve(t, "reject")} title="Tolak" className="p-1.5 rounded-lg hover:bg-error-container text-error">
                            <span className="material-symbols-outlined text-[18px]">cancel</span>
                          </button>
                        </>
                      )}
                      {t.status !== "approved" && (t.source_type === "manual" || !t.source_type) && (
                        <button onClick={() => openEdit(t)} title="Edit" className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                      )}
                      <button onClick={() => remove(t)} title="Hapus" className="p-1.5 rounded-lg hover:bg-error-container text-error">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
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
          <Card className="w-full max-w-lg p-6">
            <div onClick={(e) => e.stopPropagation()}>
              <h3 className="font-h3 text-h3 text-on-surface mb-4">{modal === "add" ? "Tambah" : "Edit"} Transaksi</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-label-sm text-on-surface-variant col-span-1">Tanggal
                  <input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
                </label>
                <label className="text-label-sm text-on-surface-variant col-span-1">Tipe
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense", category_id: 0 })}
                    style={{ paddingTop: '10px', paddingBottom: '10px' }}
                    className="mt-1 appearance-none w-full px-3 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface">
                    <option value="income">Pemasukan</option>
                    <option value="expense">Pengeluaran</option>
                  </select>
                </label>
                <label className="text-label-sm text-on-surface-variant col-span-2">Kategori
                  <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
                    style={{ paddingTop: '10px', paddingBottom: '10px' }}
                    className="mt-1 appearance-none w-full px-3 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface">
                    <option value={0}>-- pilih --</option>
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-label-sm text-on-surface-variant col-span-1">Nominal (Rp)
                  <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
                </label>
                <label className="text-label-sm text-on-surface-variant col-span-1">Metode
                  <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    style={{ paddingTop: '10px', paddingBottom: '10px' }}
                    className="mt-1 appearance-none w-full px-3 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface">
                    {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
                <label className="text-label-sm text-on-surface-variant col-span-2">No. Referensi
                  <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="No. nota / bukti"
                    className="mt-1 w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
                </label>
                <label className="text-label-sm text-on-surface-variant col-span-2">Deskripsi
                  <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
                </label>
              </div>
              {modal === "add" && (
                <p className="text-[11px] text-on-surface-variant mt-3">Transaksi akan berstatus <b>Menunggu</b> dan baru mempengaruhi saldo setelah disetujui admin.</p>
              )}
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
