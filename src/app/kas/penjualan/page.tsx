"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { FetchErrorRow } from "@/components/ui/FetchError";

interface Sale {
  id: number; sale_number: string; sale_date: string; buyer_name: string | null;
  payment_method: string; total_amount: number | string; notes: string | null;
  posted_to_kas: number; cash_trx_id: number | null; cash_status: string | null; item_count: number;
}
interface ItemForm { item_name: string; quantity: string; unit_price: string }
interface SaleDetailItem {
  id: number;
  item_name: string;
  quantity: number | string;
  unit_price: number | string;
  subtotal: number | string;
}
interface SaleDetail extends Sale {
  cash_transaction_number?: string | null;
  created_at?: string;
  items: SaleDetailItem[];
}

const fmt = (n: number | string) => "Rp " + Number(n ?? 0).toLocaleString("id-ID");
const today = () => new Date().toISOString().slice(0, 10);
const PAY_METHODS = ["Tunai", "Transfer", "QRIS", "Lainnya"] as const;

export default function PenjualanPage() {
  const router = useRouter();
  const [data, setData] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [modal, setModal] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    sale_date: today(), buyer_name: "", payment_method: "Tunai" as string, notes: "",
  });
  const [items, setItems] = useState<ItemForm[]>([{ item_name: "", quantity: "1", unit_price: "" }]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true); setFetchError(false);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("limit", "200");
      const res = await fetch(`/api/kas/penjualan?${params}`);
      if (res.status === 401) { router.push("/login"); return; }
      const json = await res.json();
      setData(json.data ?? []);
    } catch { setFetchError(true); } finally { setLoading(false); }
  }, [router, search, from, to]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const total = items.reduce((sum, it) => {
    const q = Number(it.quantity), p = Number(it.unit_price);
    return sum + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
  }, 0);

  const addItem = () => setItems([...items, { item_name: "", quantity: "1", unit_price: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: keyof ItemForm, val: string) => {
    setItems(items.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  };

  const open = () => {
    setForm({ sale_date: today(), buyer_name: "", payment_method: "Tunai", notes: "" });
    setItems([{ item_name: "", quantity: "1", unit_price: "" }]);
    setModal(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
    setDetailError(null);
  };

  const openDetail = async (saleId: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const res = await fetch(`/api/kas/penjualan/${saleId}`);
      if (res.status === 401) { router.push("/login"); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal memuat detail penjualan");
      setDetail(json);
    } catch (e) {
      setDetailError((e as Error).message ?? "Gagal memuat detail penjualan");
    } finally {
      setDetailLoading(false);
    }
  };

  const submit = async () => {
    const cleaned = items.filter((it) => it.item_name.trim() && Number(it.quantity) > 0 && Number(it.unit_price) >= 0);
    if (cleaned.length === 0) { showToast("Tambahkan minimal 1 item valid", "error"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/kas/penjualan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: cleaned.map((it) => ({ item_name: it.item_name, quantity: Number(it.quantity), unit_price: Number(it.unit_price) })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(`Penjualan ${json.sale_number} dibuat. Transaksi kas menunggu persetujuan.`);
      setModal(false); load();
    } catch (e) { showToast((e as Error).message ?? "Gagal", "error"); }
    finally { setSubmitting(false); }
  };

  const remove = async (s: Sale) => {
    if (!confirm(`Hapus penjualan ${s.sale_number}? Transaksi kas terkait juga ikut terhapus jika belum disetujui.`)) return;
    try {
      const res = await fetch(`/api/kas/penjualan/${s.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast("Penjualan dihapus"); load();
      if (detail?.id === s.id) {
        closeDetail();
      }
    } catch (e) { showToast((e as Error).message ?? "Gagal", "error"); }
  };

  const renderCashStatus = (status?: string | null) => {
    if (status === "approved") return <Badge label="Disetujui" variant="success" />;
    if (status === "pending") return <Badge label="Menunggu" variant="warning" />;
    if (status) return <Badge label={status} variant="neutral" />;
    return <Badge label="—" variant="neutral" />;
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
            <h2 className="font-h2 text-h2 text-primary">Penjualan Barang</h2>
            <p className="text-body-sm text-on-surface-variant">Catat penjualan; otomatis menghasilkan transaksi pemasukan kas (perlu approval).</p>
          </div>
          <button onClick={open} className="px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md inline-flex items-center gap-2 hover:bg-primary-container">
            <span className="material-symbols-outlined text-[18px]">add</span> Tambah Penjualan
          </button>
        </div>

        <Card>
          <div className="p-4 flex flex-wrap gap-2 border-b border-outline-variant">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-body-sm" />
            <span className="text-on-surface-variant self-center">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-body-sm" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor / pembeli..."
              className="flex-1 min-w-[180px] px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-body-sm" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                  <th className="px-4 py-3">Nomor</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Pembeli</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3">Status Kas</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {fetchError ? <FetchErrorRow colSpan={8} onRetry={load} /> :
                 loading ? <tr><td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant">Memuat...</td></tr> :
                 data.length === 0 ? <tr><td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant">
                   <span className="material-symbols-outlined text-[40px] block mb-2 opacity-30">storefront</span>
                   Belum ada penjualan tercatat.
                 </td></tr> :
                 data.map((s) => (
                   <tr key={s.id} className="hover:bg-surface-container-low/50 text-body-sm">
                     <td className="px-4 py-3 font-mono text-[12px]">{s.sale_number}</td>
                     <td className="px-4 py-3 whitespace-nowrap">{s.sale_date}</td>
                     <td className="px-4 py-3">{s.buyer_name ?? "-"}</td>
                     <td className="px-4 py-3 text-on-surface-variant">{s.item_count} item</td>
                     <td className="px-4 py-3 text-right font-label-md text-tertiary whitespace-nowrap">{fmt(s.total_amount)}</td>
                     <td className="px-4 py-3 text-on-surface-variant">{s.payment_method}</td>
                      <td className="px-4 py-3">{renderCashStatus(s.cash_status)}</td>
                     <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => openDetail(s.id)} title="Lihat detail" className="p-1.5 rounded-lg hover:bg-surface-container text-primary">
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          <button onClick={() => remove(s)} title="Hapus" className="p-1.5 rounded-lg hover:bg-error-container text-error">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                     </td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal tambah penjualan */}
      {modal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setModal(false)}>
          <Card className="w-full max-w-2xl p-6 my-8">
            <div onClick={(e) => e.stopPropagation()}>
              <h3 className="font-h3 text-h3 text-on-surface mb-4">Tambah Penjualan</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <label className="text-label-sm text-on-surface-variant">Tanggal
                  <input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
                </label>
                <label className="text-label-sm text-on-surface-variant">Metode Pembayaran
                  <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    style={{ paddingTop: '10px', paddingBottom: '10px' }}
                    className="mt-1 appearance-none w-full px-3 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface">
                    {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
                <label className="text-label-sm text-on-surface-variant col-span-2">Pembeli (opsional)
                  <input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
                </label>
                <label className="text-label-sm text-on-surface-variant col-span-2">Catatan
                  <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
                </label>
              </div>

              <div className="border-t border-outline-variant pt-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-label-md text-on-surface uppercase tracking-wide">Item</h4>
                  <button onClick={addItem} className="text-label-sm text-primary inline-flex items-center gap-1 hover:underline">
                    <span className="material-symbols-outlined text-[16px]">add</span> Item
                  </button>
                </div>
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  {items.map((it, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input value={it.item_name} placeholder="Nama barang" onChange={(e) => updateItem(i, "item_name", e.target.value)}
                        className="col-span-5 px-2 py-1.5 border border-outline-variant rounded-lg bg-surface text-body-sm" />
                      <input type="number" value={it.quantity} placeholder="Qty" min={0} step="0.01" onChange={(e) => updateItem(i, "quantity", e.target.value)}
                        className="col-span-2 px-2 py-1.5 border border-outline-variant rounded-lg bg-surface text-body-sm" />
                      <input type="number" value={it.unit_price} placeholder="Harga" min={0} onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                        className="col-span-3 px-2 py-1.5 border border-outline-variant rounded-lg bg-surface text-body-sm" />
                      <span className="col-span-1 text-right text-body-sm text-on-surface-variant whitespace-nowrap">
                        {fmt((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                      </span>
                      <button onClick={() => removeItem(i)} disabled={items.length === 1} className="col-span-1 p-1.5 rounded-lg hover:bg-error-container text-error disabled:opacity-30">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-outline-variant">
                  <span className="font-label-md text-on-surface uppercase">Total</span>
                  <span className="font-h3 text-h3 text-tertiary">{fmt(total)}</span>
                </div>
              </div>

              <p className="text-[11px] text-on-surface-variant mt-3">
                Setelah disimpan, sistem otomatis membuat transaksi pemasukan kas (kategori <b>Penjualan Barang</b>) berstatus <b>Menunggu</b> persetujuan.
              </p>

              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container">Batal</button>
                <button onClick={submit} disabled={submitting || total <= 0} className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container disabled:opacity-50">
                  {submitting ? "Menyimpan..." : "Simpan Penjualan"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {detailOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={closeDetail}>
          <Card className="w-full max-w-3xl p-6 my-8">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h3 className="font-h3 text-h3 text-on-surface">Detail Penjualan</h3>
                  <p className="text-body-sm text-on-surface-variant">Lihat rincian transaksi penjualan barang dan status kas terkait.</p>
                </div>
                <button onClick={closeDetail} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container" aria-label="Tutup detail penjualan">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {detailLoading ? (
                <div className="py-16 text-center text-on-surface-variant">Memuat detail penjualan...</div>
              ) : detailError ? (
                <div className="rounded-xl border border-error/20 bg-error-container/50 px-4 py-5 text-error">
                  <p className="font-label-md mb-1">Gagal memuat detail</p>
                  <p className="text-body-sm">{detailError}</p>
                </div>
              ) : detail ? (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low">
                      <p className="text-label-sm text-on-surface-variant mb-1">Nomor Penjualan</p>
                      <p className="font-label-md text-on-surface break-all">{detail.sale_number}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low">
                      <p className="text-label-sm text-on-surface-variant mb-1">Tanggal Penjualan</p>
                      <p className="font-label-md text-on-surface">{detail.sale_date}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low">
                      <p className="text-label-sm text-on-surface-variant mb-1">Pembeli</p>
                      <p className="font-label-md text-on-surface">{detail.buyer_name || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low">
                      <p className="text-label-sm text-on-surface-variant mb-1">Metode Pembayaran</p>
                      <p className="font-label-md text-on-surface">{detail.payment_method}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low">
                      <p className="text-label-sm text-on-surface-variant mb-1">Status Kas</p>
                      <div className="mt-1">{renderCashStatus(detail.cash_status)}</div>
                    </div>
                    <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low">
                      <p className="text-label-sm text-on-surface-variant mb-1">No. Transaksi Kas</p>
                      <p className="font-label-md text-on-surface">{detail.cash_transaction_number || "-"}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-outline-variant overflow-hidden">
                    <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low">
                      <h4 className="font-label-md text-on-surface uppercase tracking-wide">Daftar Item</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                            <th className="px-4 py-3">Barang</th>
                            <th className="px-4 py-3 text-right">Qty</th>
                            <th className="px-4 py-3 text-right">Harga</th>
                            <th className="px-4 py-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {detail.items.map((item) => (
                            <tr key={item.id} className="text-body-sm">
                              <td className="px-4 py-3 text-on-surface">{item.item_name}</td>
                              <td className="px-4 py-3 text-right text-on-surface-variant">{Number(item.quantity).toLocaleString("id-ID")}</td>
                              <td className="px-4 py-3 text-right text-on-surface-variant whitespace-nowrap">{fmt(item.unit_price)}</td>
                              <td className="px-4 py-3 text-right font-label-md text-on-surface whitespace-nowrap">{fmt(item.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-surface-container-low font-label-md text-on-surface">
                            <td className="px-4 py-3" colSpan={3}>Total</td>
                            <td className="px-4 py-3 text-right text-tertiary whitespace-nowrap">{fmt(detail.total_amount)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low">
                    <p className="text-label-sm text-on-surface-variant mb-1">Catatan</p>
                    <p className="text-body-sm text-on-surface whitespace-pre-wrap">{detail.notes || "-"}</p>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={closeDetail} className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container">Tutup</button>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
