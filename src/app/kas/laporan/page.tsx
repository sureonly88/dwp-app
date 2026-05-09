"use client";

import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { FetchErrorBox } from "@/components/ui/FetchError";

interface Rekap { id: number; code: string; name: string; total: number }
interface Trx {
  id: number; transaction_number: string; transaction_date: string;
  type: "income" | "expense"; category_name: string; amount: number; status: string; description: string | null;
}
interface Lap {
  periode: { bulan: number; tahun: number; awal: string; akhir: string; label: string };
  saldo_awal: number; saldo_akhir: number; total_income: number; total_expense: number;
  rekap_pemasukan: Rekap[]; rekap_pengeluaran: Rekap[]; transaksi: Trx[];
}

const fmt = (n: number) => "Rp " + (n ?? 0).toLocaleString("id-ID");
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export default function LaporanKasPage() {
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [data, setData] = useState<Lap | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFetchError(false);
    try {
      const res = await fetch(`/api/kas/laporan?bulan=${bulan}&tahun=${tahun}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { setFetchError(true); } finally { setLoading(false); }
  }, [bulan, tahun]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    const lines: string[][] = [];
    lines.push(["LAPORAN KAS BULANAN"]);
    lines.push(["Periode", data.periode.label]);
    lines.push(["Saldo Awal", String(data.saldo_awal)]);
    lines.push(["Total Pemasukan", String(data.total_income)]);
    lines.push(["Total Pengeluaran", String(data.total_expense)]);
    lines.push(["Saldo Akhir", String(data.saldo_akhir)]);
    lines.push([""]);
    lines.push(["REKAP PEMASUKAN"]);
    lines.push(["Kategori", "Total"]);
    data.rekap_pemasukan.forEach((r) => lines.push([r.name, String(r.total)]));
    lines.push([""]);
    lines.push(["REKAP PENGELUARAN"]);
    lines.push(["Kategori", "Total"]);
    data.rekap_pengeluaran.forEach((r) => lines.push([r.name, String(r.total)]));
    lines.push([""]);
    lines.push(["DETAIL TRANSAKSI (DISETUJUI)"]);
    lines.push(["Tanggal", "Nomor", "Tipe", "Kategori", "Deskripsi", "Nominal"]);
    data.transaksi.forEach((t) => lines.push([t.transaction_date, t.transaction_number, t.type, t.category_name, t.description ?? "", String(t.amount)]));
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `laporan-kas-${tahun}-${String(bulan).padStart(2,"0")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-h2 text-h2 text-primary">Laporan Kas Bulanan</h2>
            <p className="text-body-sm text-on-surface-variant">Ringkasan keuangan periode bulanan (transaksi disetujui).</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-xl font-label-md inline-flex items-center gap-2 hover:bg-surface-container">
              <span className="material-symbols-outlined text-[18px]">print</span> Cetak
            </button>
            <button onClick={exportCsv} disabled={!data} className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-xl font-label-md inline-flex items-center gap-2 hover:bg-surface-container disabled:opacity-40">
              <span className="material-symbols-outlined text-[18px]">download</span> Ekspor CSV
            </button>
          </div>
        </div>

        <Card className="p-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-label-sm text-on-surface-variant">Bulan
              <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))}
                style={{ paddingTop: '10px', paddingBottom: '10px' }}
                className="mt-1 block appearance-none px-3 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label className="text-label-sm text-on-surface-variant">Tahun
              <input type="number" value={tahun} min={2000} max={2100} onChange={(e) => setTahun(Number(e.target.value))}
                className="mt-1 block px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none w-28" />
            </label>
            <button onClick={load} className="px-4 py-2 border border-outline-variant rounded-lg hover:bg-surface-container text-on-surface-variant">Tampilkan</button>
          </div>
        </Card>

        {fetchError ? (
          <Card className="p-6"><FetchErrorBox onRetry={load} /></Card>
        ) : loading || !data ? (
          <Card className="p-12 text-center text-on-surface-variant">Memuat...</Card>
        ) : (
          <>
            <Card className="p-6">
              <h3 className="font-h3 text-h3 text-primary text-center mb-1">Laporan Kas DWP</h3>
              <p className="text-body-sm text-on-surface-variant text-center mb-5">Periode {data.periode.label}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-surface-container-low rounded-xl"><p className="text-label-sm text-on-surface-variant">Saldo Awal</p><p className="font-h3 text-h3">{fmt(data.saldo_awal)}</p></div>
                <div className="p-4 bg-tertiary-container/30 rounded-xl"><p className="text-label-sm text-on-surface-variant">Pemasukan</p><p className="font-h3 text-h3 text-tertiary">{fmt(data.total_income)}</p></div>
                <div className="p-4 bg-error-container/30 rounded-xl"><p className="text-label-sm text-on-surface-variant">Pengeluaran</p><p className="font-h3 text-h3 text-error">{fmt(data.total_expense)}</p></div>
                <div className="p-4 bg-primary-container/30 rounded-xl"><p className="text-label-sm text-on-surface-variant">Saldo Akhir</p><p className="font-h3 text-h3 text-primary">{fmt(data.saldo_akhir)}</p></div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-6">
                <h4 className="font-label-md text-on-surface uppercase tracking-wide mb-3">Rekap Pemasukan per Kategori</h4>
                {data.rekap_pemasukan.length === 0 ? <p className="text-body-sm text-on-surface-variant">Tidak ada.</p> : (
                  <table className="w-full">
                    <tbody className="divide-y divide-outline-variant">
                      {data.rekap_pemasukan.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2 text-body-sm">{r.name}</td>
                          <td className="py-2 text-right font-label-md text-tertiary whitespace-nowrap">{fmt(r.total)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-outline">
                        <td className="py-2 font-label-md">Total</td>
                        <td className="py-2 text-right font-h3 text-tertiary">{fmt(data.total_income)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </Card>
              <Card className="p-6">
                <h4 className="font-label-md text-on-surface uppercase tracking-wide mb-3">Rekap Pengeluaran per Kategori</h4>
                {data.rekap_pengeluaran.length === 0 ? <p className="text-body-sm text-on-surface-variant">Tidak ada.</p> : (
                  <table className="w-full">
                    <tbody className="divide-y divide-outline-variant">
                      {data.rekap_pengeluaran.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2 text-body-sm">{r.name}</td>
                          <td className="py-2 text-right font-label-md text-error whitespace-nowrap">{fmt(r.total)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-outline">
                        <td className="py-2 font-label-md">Total</td>
                        <td className="py-2 text-right font-h3 text-error">{fmt(data.total_expense)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </Card>
            </div>

            <Card>
              <div className="p-4 border-b border-outline-variant">
                <h4 className="font-label-md text-on-surface uppercase tracking-wide">Detail Transaksi Disetujui</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Nomor</th>
                      <th className="px-4 py-3">Tipe</th>
                      <th className="px-4 py-3">Kategori</th>
                      <th className="px-4 py-3">Deskripsi</th>
                      <th className="px-4 py-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-body-sm">
                    {data.transaksi.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant">Tidak ada transaksi.</td></tr>
                    ) : data.transaksi.map((t) => (
                      <tr key={t.id}>
                        <td className="px-4 py-2 whitespace-nowrap">{t.transaction_date}</td>
                        <td className="px-4 py-2 font-mono text-[12px]">{t.transaction_number}</td>
                        <td className="px-4 py-2"><Badge label={t.type === "income" ? "In" : "Out"} variant={t.type === "income" ? "success" : "error"} /></td>
                        <td className="px-4 py-2">{t.category_name}</td>
                        <td className="px-4 py-2 text-on-surface-variant max-w-[280px] truncate">{t.description ?? "-"}</td>
                        <td className={`px-4 py-2 text-right font-label-md whitespace-nowrap ${t.type === "income" ? "text-tertiary" : "text-error"}`}>{fmt(Number(t.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
