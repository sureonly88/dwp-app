"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { FetchErrorBox } from "@/components/ui/FetchError";

interface CategoryTotal { id: number; code: string; name: string; total: number }
interface PendingTrx {
  id: number; transaction_number: string; transaction_date: string;
  type: "income" | "expense"; amount: number; category_name: string; description: string | null;
}
interface DashData {
  saldo_total: number;
  bulan_ini: { total_income: number; total_expense: number; balance: number };
  pending_count: number;
  approved_count: number;
  trend_6_bulan: { ym: string; income: number; expense: number; net: number }[];
  top_pemasukan_bulan_ini: CategoryTotal[];
  top_pengeluaran_bulan_ini: CategoryTotal[];
  pending_transaksi: PendingTrx[];
}

const fmt = (n: number) => "Rp " + (n ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const monthLabel = (ym: string) => {
  const [, m] = ym.split("-");
  return ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][parseInt(m,10)-1];
};

export default function KasDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFetchError(false);
    try {
      const res = await fetch("/api/kas/dashboard");
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { setFetchError(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-h2 text-h2 text-primary">Dashboard Kas</h2>
            <p className="text-body-sm text-on-surface-variant">Ringkasan keuangan organisasi DWP</p>
          </div>
          <div className="flex gap-2">
            <Link href="/kas/transaksi" className="px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary-container inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              Transaksi
            </Link>
            <Link href="/kas/buku" className="px-4 py-2 border border-outline-variant text-on-surface rounded-xl font-label-md hover:bg-surface-container inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              Buku Kas
            </Link>
          </div>
        </div>

        {fetchError ? (
          <Card className="p-6"><FetchErrorBox onRetry={load} /></Card>
        ) : loading || !data ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[0,1,2,3].map((i) => (
              <Card key={i} className="p-6 animate-pulse h-28 bg-surface-container-low"><div /></Card>
            ))}
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6 border-l-4 border-l-primary">
                <div className="flex items-center justify-between mb-2">
                  <span className="material-symbols-outlined text-primary text-[24px]">account_balance</span>
                  <Badge label="Saldo" variant="info" />
                </div>
                <p className="text-label-sm text-on-surface-variant uppercase">Saldo Kas</p>
                <p className="font-h2 text-h2 text-on-surface">{fmt(data.saldo_total)}</p>
              </Card>
              <Card className="p-6 border-l-4 border-l-tertiary">
                <div className="flex items-center justify-between mb-2">
                  <span className="material-symbols-outlined text-tertiary text-[24px]">trending_up</span>
                  <Badge label="Bulan Ini" variant="success" />
                </div>
                <p className="text-label-sm text-on-surface-variant uppercase">Pemasukan</p>
                <p className="font-h2 text-h2 text-tertiary">{fmt(data.bulan_ini.total_income)}</p>
              </Card>
              <Card className="p-6 border-l-4 border-l-error">
                <div className="flex items-center justify-between mb-2">
                  <span className="material-symbols-outlined text-error text-[24px]">trending_down</span>
                  <Badge label="Bulan Ini" variant="error" />
                </div>
                <p className="text-label-sm text-on-surface-variant uppercase">Pengeluaran</p>
                <p className="font-h2 text-h2 text-error">{fmt(data.bulan_ini.total_expense)}</p>
              </Card>
              <Card className="p-6 border-l-4 border-l-secondary">
                <div className="flex items-center justify-between mb-2">
                  <span className="material-symbols-outlined text-secondary text-[24px]">pending_actions</span>
                  <Badge label={`${data.pending_count}`} variant="warning" />
                </div>
                <p className="text-label-sm text-on-surface-variant uppercase">Menunggu Approval</p>
                <p className="font-h2 text-h2 text-on-surface">{data.pending_count}</p>
                <p className="text-[11px] text-on-surface-variant mt-1">{data.approved_count} disetujui</p>
              </Card>
            </div>

            {/* Trend bar chart (sederhana) */}
            <Card className="p-6">
              <h3 className="font-h3 text-h3 text-on-surface mb-4">Tren 6 Bulan Terakhir</h3>
              {data.trend_6_bulan.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant">Belum ada data.</p>
              ) : (
                <div className="flex items-end gap-3 h-48 overflow-x-auto pb-2">
                  {data.trend_6_bulan.map((m) => {
                    const max = Math.max(1, ...data.trend_6_bulan.flatMap((x) => [x.income, x.expense]));
                    const inH = (m.income / max) * 100;
                    const exH = (m.expense / max) * 100;
                    return (
                      <div key={m.ym} className="flex-1 min-w-[60px] flex flex-col items-center gap-2">
                        <div className="w-full flex justify-center items-end gap-1 h-36">
                          <div title={`Pemasukan ${fmt(m.income)}`} className="w-3 bg-tertiary rounded-t" style={{ height: `${inH}%` }} />
                          <div title={`Pengeluaran ${fmt(m.expense)}`} className="w-3 bg-error rounded-t" style={{ height: `${exH}%` }} />
                        </div>
                        <span className="text-[11px] text-on-surface-variant">{monthLabel(m.ym)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-4 mt-3 text-label-sm">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-tertiary"/>Pemasukan</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-error"/>Pengeluaran</span>
              </div>
            </Card>

            {/* Top categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-6">
                <h3 className="font-h3 text-h3 text-on-surface mb-3">Pemasukan Bulan Ini per Kategori</h3>
                {data.top_pemasukan_bulan_ini.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant">Belum ada pemasukan disetujui.</p>
                ) : (
                  <ul className="divide-y divide-outline-variant">
                    {data.top_pemasukan_bulan_ini.map((c) => (
                      <li key={c.id} className="py-2 flex justify-between items-center">
                        <span className="text-body-sm text-on-surface">{c.name}</span>
                        <span className="font-label-md text-tertiary">{fmt(c.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-6">
                <h3 className="font-h3 text-h3 text-on-surface mb-3">Pengeluaran Bulan Ini per Kategori</h3>
                {data.top_pengeluaran_bulan_ini.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant">Belum ada pengeluaran disetujui.</p>
                ) : (
                  <ul className="divide-y divide-outline-variant">
                    {data.top_pengeluaran_bulan_ini.map((c) => (
                      <li key={c.id} className="py-2 flex justify-between items-center">
                        <span className="text-body-sm text-on-surface">{c.name}</span>
                        <span className="font-label-md text-error">{fmt(c.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* Pending transactions */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-h3 text-h3 text-on-surface">Menunggu Persetujuan</h3>
                <Link href="/kas/transaksi?status=pending" className="text-label-sm text-primary hover:underline">Lihat semua →</Link>
              </div>
              {data.pending_transaksi.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant">Tidak ada transaksi menunggu persetujuan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant">
                        <th className="py-2 px-3">Nomor</th>
                        <th className="py-2 px-3">Tanggal</th>
                        <th className="py-2 px-3">Kategori</th>
                        <th className="py-2 px-3">Tipe</th>
                        <th className="py-2 px-3 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {data.pending_transaksi.map((t) => (
                        <tr key={t.id} className="text-body-sm">
                          <td className="py-2 px-3 font-mono">{t.transaction_number}</td>
                          <td className="py-2 px-3">{t.transaction_date}</td>
                          <td className="py-2 px-3">{t.category_name}</td>
                          <td className="py-2 px-3">
                            <Badge label={t.type === "income" ? "Pemasukan" : "Pengeluaran"} variant={t.type === "income" ? "success" : "error"} />
                          </td>
                          <td className={`py-2 px-3 text-right font-label-md ${t.type === "income" ? "text-tertiary" : "text-error"}`}>
                            {fmt(Number(t.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
