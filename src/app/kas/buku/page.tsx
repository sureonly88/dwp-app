"use client";

import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { FetchErrorBox } from "@/components/ui/FetchError";

interface Row {
  id: number; transaction_number: string; transaction_date: string;
  type: "income" | "expense"; category_name: string; description: string | null;
  debit: number; kredit: number; saldo: number;
}
interface BukuData {
  from: string; to: string;
  saldo_awal: number; saldo_akhir: number; total_debit: number; total_kredit: number;
  data: Row[];
}

const fmt = (n: number) => "Rp " + (n ?? 0).toLocaleString("id-ID");
const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

export default function BukuKasPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<BukuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFetchError(false);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/kas/buku?${params}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { setFetchError(true); } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    const header = ["Tanggal", "Nomor", "Kategori", "Keterangan", "Debit", "Kredit", "Saldo"];
    const rows: string[][] = [["", "", "Saldo Awal", "", "", "", String(data.saldo_awal)]];
    for (const r of data.data) {
      rows.push([r.transaction_date, r.transaction_number, r.category_name, r.description ?? "", String(r.debit), String(r.kredit), String(r.saldo)]);
    }
    rows.push(["", "", "Total / Saldo Akhir", "", String(data.total_debit), String(data.total_kredit), String(data.saldo_akhir)]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `buku-kas-${from}-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-h2 text-h2 text-primary">Buku Kas</h2>
            <p className="text-body-sm text-on-surface-variant">Catatan kronologis dengan saldo berjalan (hanya transaksi disetujui).</p>
          </div>
          <button onClick={exportCsv} disabled={!data || data.data.length === 0}
            className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-xl font-label-md inline-flex items-center gap-2 hover:bg-surface-container disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">download</span> Ekspor CSV
          </button>
        </div>

        <Card>
          <div className="p-4 flex flex-wrap items-end gap-3 border-b border-outline-variant">
            <label className="text-label-sm text-on-surface-variant">Dari
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
            </label>
            <label className="text-label-sm text-on-surface-variant">Sampai
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="mt-1 block px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
            </label>
            <button onClick={load} className="px-4 py-2 border border-outline-variant rounded-lg hover:bg-surface-container text-on-surface-variant">Tampilkan</button>
          </div>

          {fetchError ? (
            <div className="p-6"><FetchErrorBox onRetry={load} /></div>
          ) : loading || !data ? (
            <p className="py-12 text-center text-on-surface-variant">Memuat...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-surface-container-low">
                <div><p className="text-label-sm text-on-surface-variant">Saldo Awal</p><p className="font-h3 text-h3">{fmt(data.saldo_awal)}</p></div>
                <div><p className="text-label-sm text-on-surface-variant">Total Debit</p><p className="font-h3 text-h3 text-tertiary">{fmt(data.total_debit)}</p></div>
                <div><p className="text-label-sm text-on-surface-variant">Total Kredit</p><p className="font-h3 text-h3 text-error">{fmt(data.total_kredit)}</p></div>
                <div><p className="text-label-sm text-on-surface-variant">Saldo Akhir</p><p className="font-h3 text-h3 text-primary">{fmt(data.saldo_akhir)}</p></div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low text-label-md text-on-surface-variant border-y border-outline-variant">
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Nomor</th>
                      <th className="px-4 py-3">Kategori</th>
                      <th className="px-4 py-3">Keterangan</th>
                      <th className="px-4 py-3 text-right">Debit</th>
                      <th className="px-4 py-3 text-right">Kredit</th>
                      <th className="px-4 py-3 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-body-sm">
                    <tr className="bg-surface-container-low/50 italic">
                      <td colSpan={6} className="px-4 py-2 text-right text-on-surface-variant">Saldo Awal</td>
                      <td className="px-4 py-2 text-right font-label-md">{fmt(data.saldo_awal)}</td>
                    </tr>
                    {data.data.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant">Tidak ada transaksi disetujui pada periode ini.</td></tr>
                    ) : data.data.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-container-low/50">
                        <td className="px-4 py-2 whitespace-nowrap">{r.transaction_date}</td>
                        <td className="px-4 py-2 font-mono text-[12px]">{r.transaction_number}</td>
                        <td className="px-4 py-2">{r.category_name}</td>
                        <td className="px-4 py-2 text-on-surface-variant max-w-[280px] truncate">{r.description ?? "-"}</td>
                        <td className="px-4 py-2 text-right text-tertiary whitespace-nowrap">{r.debit > 0 ? fmt(r.debit) : "-"}</td>
                        <td className="px-4 py-2 text-right text-error whitespace-nowrap">{r.kredit > 0 ? fmt(r.kredit) : "-"}</td>
                        <td className="px-4 py-2 text-right font-label-md whitespace-nowrap">{fmt(r.saldo)}</td>
                      </tr>
                    ))}
                    <tr className="bg-surface-container font-label-md">
                      <td colSpan={4} className="px-4 py-2 text-right">Total</td>
                      <td className="px-4 py-2 text-right text-tertiary">{fmt(data.total_debit)}</td>
                      <td className="px-4 py-2 text-right text-error">{fmt(data.total_kredit)}</td>
                      <td className="px-4 py-2 text-right text-primary">{fmt(data.saldo_akhir)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
