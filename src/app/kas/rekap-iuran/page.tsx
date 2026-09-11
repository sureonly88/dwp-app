"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { FetchErrorBox } from "@/components/ui/FetchError";

interface FundRow {
  code: string;
  name: string;
  saldo_awal: number;
  total_pemasukan: number;
  total_pengeluaran: number;
  saldo_akhir: number;
}

interface MonthlyRow {
  ym: string;
  label: string;
  funds: FundRow[];
  total_pemasukan: number;
  total_pengeluaran: number;
  saldo_akhir: number;
}

interface TransactionRow {
  id: number;
  transaction_number: string;
  transaction_date: string;
  type: "income" | "expense";
  amount: number;
  description: string | null;
  category_name: string;
  source_fund_label: string;
  dana_code: string;
  dana_name: string;
}

interface RekapIuranResponse {
  periode: {
    bulan_awal: number;
    tahun_awal: number;
    bulan_akhir: number;
    tahun_akhir: number;
    awal: string;
    akhir: string;
    label_awal: string;
    label_akhir: string;
    label: string;
    tanggal_serah_terima: string;
  };
  summary: FundRow[];
  total: {
    saldo_awal: number;
    total_pemasukan: number;
    total_pengeluaran: number;
    saldo_akhir: number;
  };
  monthly: MonthlyRow[];
  transaksi: TransactionRow[];
}

type PrintScope = "all" | "iuran_anggota" | "iuran_konsumsi_anggota" | "iuran_pengurus";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const PRINT_SCOPE_OPTIONS: Array<{ value: PrintScope; label: string }> = [
  { value: "all", label: "Semua Kas Iuran" },
  { value: "iuran_anggota", label: "Iuran Kas Anggota" },
  { value: "iuran_konsumsi_anggota", label: "Iuran Kas Konsumsi" },
  { value: "iuran_pengurus", label: "Iuran Kas Pengurus" },
];

const fmt = (n: number) => "Rp " + (n ?? 0).toLocaleString("id-ID");
const defaultStart = { bulan: 5, tahun: 2026 };

function totalFromFunds(funds: FundRow[]) {
  return {
    saldo_awal: funds.reduce((sum, fund) => sum + fund.saldo_awal, 0),
    total_pemasukan: funds.reduce((sum, fund) => sum + fund.total_pemasukan, 0),
    total_pengeluaran: funds.reduce((sum, fund) => sum + fund.total_pengeluaran, 0),
    saldo_akhir: funds.reduce((sum, fund) => sum + fund.saldo_akhir, 0),
  };
}

function filterByPrintScope(data: RekapIuranResponse, scope: PrintScope): RekapIuranResponse {
  if (scope === "all") return data;

  const summary = data.summary.filter((fund) => fund.code === scope);
  const monthly = data.monthly.map((month) => {
    const funds = month.funds.filter((fund) => fund.code === scope);

    return {
      ...month,
      funds,
      total_pemasukan: funds.reduce((sum, fund) => sum + fund.total_pemasukan, 0),
      total_pengeluaran: funds.reduce((sum, fund) => sum + fund.total_pengeluaran, 0),
      saldo_akhir: funds.reduce((sum, fund) => sum + fund.saldo_akhir, 0),
    };
  });

  return {
    ...data,
    summary,
    total: totalFromFunds(summary),
    monthly,
    transaksi: data.transaksi.filter((trx) => trx.dana_code === scope),
  };
}

export default function RekapIuranKasPage() {
  const now = useMemo(() => new Date(), []);
  const [bulanAwal, setBulanAwal] = useState(defaultStart.bulan);
  const [tahunAwal, setTahunAwal] = useState(defaultStart.tahun);
  const [bulanAkhir, setBulanAkhir] = useState(now.getMonth() + 1);
  const [tahunAkhir, setTahunAkhir] = useState(now.getFullYear());
  const [data, setData] = useState<RekapIuranResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [usingDefaultPeriod, setUsingDefaultPeriod] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [printScope, setPrintScope] = useState<PrintScope>("all");

  const displayData = useMemo(
    () => data ? filterByPrintScope(data, printScope) : null,
    [data, printScope]
  );

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setFetchError(false);

    try {
      const params = new URLSearchParams();
      if (!usingDefaultPeriod) {
        params.set("bulan_awal", String(bulanAwal));
        params.set("tahun_awal", String(tahunAwal));
        params.set("bulan_akhir", String(bulanAkhir));
        params.set("tahun_akhir", String(tahunAkhir));
      }
      const query = params.toString();
      const res = await fetch(`/api/kas/rekap-iuran${query ? `?${query}` : ""}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error();
      const json = await res.json() as RekapIuranResponse;
      setData(json);
      if (usingDefaultPeriod) {
        setBulanAwal(json.periode.bulan_awal);
        setTahunAwal(json.periode.tahun_awal);
        setBulanAkhir(json.periode.bulan_akhir);
        setTahunAkhir(json.periode.tahun_akhir);
        setUsingDefaultPeriod(false);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [bulanAwal, tahunAwal, bulanAkhir, tahunAkhir, usingDefaultPeriod]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load({ silent: true });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const exportCsv = () => {
    if (!displayData) return;

    const lines: string[][] = [];
    lines.push(["LAPORAN REKAP KAS IURAN"]);
    lines.push(["Periode", displayData.periode.label]);
    lines.push(["Pilihan Cetak", PRINT_SCOPE_OPTIONS.find((option) => option.value === printScope)?.label ?? "Semua Kas Iuran"]);
    lines.push(["Tanggal Serah Terima", displayData.periode.tanggal_serah_terima]);
    lines.push([""]);
    lines.push(["RINGKASAN"]);
    lines.push(["Dana", "Saldo Awal", "Pemasukan", "Pengeluaran", "Saldo Akhir"]);
    displayData.summary.forEach((row) => lines.push([
      row.name,
      String(row.saldo_awal),
      String(row.total_pemasukan),
      String(row.total_pengeluaran),
      String(row.saldo_akhir),
    ]));
    lines.push(["Total", String(displayData.total.saldo_awal), String(displayData.total.total_pemasukan), String(displayData.total.total_pengeluaran), String(displayData.total.saldo_akhir)]);
    lines.push([""]);
    lines.push(["REKAP BULANAN"]);
    lines.push(["Bulan", "Dana", "Saldo Awal", "Pemasukan", "Pengeluaran", "Saldo Akhir"]);
    displayData.monthly.forEach((month) => {
      month.funds.forEach((fund) => lines.push([
        month.label,
        fund.name,
        String(fund.saldo_awal),
        String(fund.total_pemasukan),
        String(fund.total_pengeluaran),
        String(fund.saldo_akhir),
      ]));
    });
    lines.push([""]);
    lines.push(["DETAIL TRANSAKSI"]);
    lines.push(["Tanggal", "Nomor", "Dana", "Tipe", "Kategori", "Keterangan", "Nominal"]);
    displayData.transaksi.forEach((trx) => lines.push([
      trx.transaction_date,
      trx.transaction_number,
      trx.dana_name,
      trx.type,
      trx.category_name,
      trx.description ?? "",
      String(trx.amount),
    ]));

    const csv = lines.map((row) => row.map((col) => `"${String(col).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-kas-iuran-${printScope}-${displayData.periode.awal}-${displayData.periode.akhir}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    const params = new URLSearchParams({
      bulan_awal: String(bulanAwal),
      tahun_awal: String(tahunAwal),
      bulan_akhir: String(bulanAkhir),
      tahun_akhir: String(tahunAkhir),
      jenis: printScope,
    });

    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/kas/rekap-iuran/pdf?${params}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Gagal membuat PDF rekap iuran");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] ?? `rekap-kas-iuran-${printScope}-${displayData?.periode.awal ?? "awal"}-${displayData?.periode.akhir ?? "akhir"}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal membuat PDF rekap iuran");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-h2 text-h2 text-primary">Rekap Kas Iuran</h2>
            <p className="text-body-sm text-on-surface-variant">
              Rekap kas iuran arisan anggota, konsumsi, dan pengurus dari serah terima sampai bulan berjalan.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-label-sm text-on-surface-variant">Pilihan Cetak
              <select
                value={printScope}
                onChange={(e) => setPrintScope(e.target.value as PrintScope)}
                style={{ paddingTop: "10px", paddingBottom: "10px" }}
                className="mt-1 block appearance-none px-3 border border-outline-variant rounded-xl bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface min-w-[210px]"
              >
                {PRINT_SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button onClick={() => window.print()} className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-xl font-label-md inline-flex items-center gap-2 hover:bg-surface-container">
              <span className="material-symbols-outlined text-[18px]">print</span> Cetak
            </button>
            <button onClick={() => void downloadPdf()} disabled={!data || downloadingPdf} className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-xl font-label-md inline-flex items-center gap-2 hover:bg-surface-container disabled:opacity-40">
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span> {downloadingPdf ? "Membuat PDF..." : "Cetak PDF"}
            </button>
            <button onClick={exportCsv} disabled={!data} className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-xl font-label-md inline-flex items-center gap-2 hover:bg-surface-container disabled:opacity-40">
              <span className="material-symbols-outlined text-[18px]">download</span> Ekspor CSV
            </button>
          </div>
        </div>

        <Card className="p-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-label-sm text-on-surface-variant">Bulan Awal
              <select value={bulanAwal} onChange={(e) => setBulanAwal(Number(e.target.value))}
                style={{ paddingTop: "10px", paddingBottom: "10px" }}
                className="mt-1 block appearance-none px-3 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface">
                {MONTHS.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}
              </select>
            </label>
            <label className="text-label-sm text-on-surface-variant">Tahun Awal
              <input type="number" value={tahunAwal} min={2000} max={2100} onChange={(e) => setTahunAwal(Number(e.target.value))}
                className="mt-1 block px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none w-28" />
            </label>
            <label className="text-label-sm text-on-surface-variant">Bulan Akhir
              <select value={bulanAkhir} onChange={(e) => setBulanAkhir(Number(e.target.value))}
                style={{ paddingTop: "10px", paddingBottom: "10px" }}
                className="mt-1 block appearance-none px-3 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface">
                {MONTHS.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}
              </select>
            </label>
            <label className="text-label-sm text-on-surface-variant">Tahun Akhir
              <input type="number" value={tahunAkhir} min={2000} max={2100} onChange={(e) => setTahunAkhir(Number(e.target.value))}
                className="mt-1 block px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none w-28" />
            </label>
            <button onClick={() => void load()} className="px-4 py-2 border border-outline-variant rounded-lg hover:bg-surface-container text-on-surface-variant">Tampilkan</button>
          </div>
        </Card>

        {fetchError ? (
          <Card className="p-6"><FetchErrorBox onRetry={load} /></Card>
        ) : loading || !displayData ? (
          <Card className="p-12 text-center text-on-surface-variant">Memuat...</Card>
        ) : (
          <>
            <Card className="p-6">
              <h3 className="font-h3 text-h3 text-primary text-center mb-1">Laporan Rekap Kas Iuran</h3>
              <p className="text-body-sm text-on-surface-variant text-center mb-1">Periode {displayData.periode.label}</p>
              <p className="text-label-sm text-on-surface-variant text-center mb-1">
                {PRINT_SCOPE_OPTIONS.find((option) => option.value === printScope)?.label ?? "Semua Kas Iuran"}
              </p>
              <p className="text-label-sm text-on-surface-variant text-center mb-5">
                Tanggal serah terima: {displayData.periode.tanggal_serah_terima}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-surface-container-low rounded-xl"><p className="text-label-sm text-on-surface-variant">Saldo Awal</p><p className="font-h3 text-h3">{fmt(displayData.total.saldo_awal)}</p></div>
                <div className="p-4 bg-tertiary-container/30 rounded-xl"><p className="text-label-sm text-on-surface-variant">Total Masuk</p><p className="font-h3 text-h3 text-tertiary">{fmt(displayData.total.total_pemasukan)}</p></div>
                <div className="p-4 bg-error-container/30 rounded-xl"><p className="text-label-sm text-on-surface-variant">Total Keluar</p><p className="font-h3 text-h3 text-error">{fmt(displayData.total.total_pengeluaran)}</p></div>
                <div className="p-4 bg-primary-container/30 rounded-xl"><p className="text-label-sm text-on-surface-variant">Saldo Akhir</p><p className="font-h3 text-h3 text-primary">{fmt(displayData.total.saldo_akhir)}</p></div>
              </div>
            </Card>

            <div className={`grid grid-cols-1 gap-4 ${printScope === "all" ? "lg:grid-cols-3" : "lg:grid-cols-1"}`}>
              {displayData.summary.map((fund) => (
                <Card key={fund.code} className="p-5 border border-outline-variant" hover={false}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-label-md text-on-surface uppercase tracking-wide">{fund.name}</h4>
                    <Badge label="Approved" variant="success" />
                  </div>
                  <p className="font-h2 text-h2 text-primary mb-3">{fmt(fund.saldo_akhir)}</p>
                  <div className="space-y-2 text-body-sm text-on-surface-variant">
                    <div className="flex justify-between gap-3"><span>Saldo Awal</span><span>{fmt(fund.saldo_awal)}</span></div>
                    <div className="flex justify-between gap-3"><span>Pemasukan</span><span className="text-tertiary">{fmt(fund.total_pemasukan)}</span></div>
                    <div className="flex justify-between gap-3"><span>Pengeluaran</span><span className="text-error">{fmt(fund.total_pengeluaran)}</span></div>
                  </div>
                </Card>
              ))}
            </div>

            <Card>
              <div className="p-4 border-b border-outline-variant">
                <h4 className="font-label-md text-on-surface uppercase tracking-wide">Rekap Bulanan</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                      <th className="px-4 py-3">Bulan</th>
                      <th className="px-4 py-3">Dana</th>
                      <th className="px-4 py-3 text-right">Saldo Awal</th>
                      <th className="px-4 py-3 text-right">Masuk</th>
                      <th className="px-4 py-3 text-right">Keluar</th>
                      <th className="px-4 py-3 text-right">Saldo Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-body-sm">
                    {displayData.monthly.map((month) => (
                      month.funds.map((fund, index) => (
                        <tr key={`${month.ym}-${fund.code}`} className="hover:bg-surface-container-low/50">
                          {index === 0 && (
                            <td rowSpan={month.funds.length} className="px-4 py-2 font-label-md text-on-surface whitespace-nowrap align-top">
                              {month.label}
                            </td>
                          )}
                          <td className="px-4 py-2">{fund.name}</td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">{fmt(fund.saldo_awal)}</td>
                          <td className="px-4 py-2 text-right text-tertiary whitespace-nowrap">{fund.total_pemasukan > 0 ? fmt(fund.total_pemasukan) : "-"}</td>
                          <td className="px-4 py-2 text-right text-error whitespace-nowrap">{fund.total_pengeluaran > 0 ? fmt(fund.total_pengeluaran) : "-"}</td>
                          <td className="px-4 py-2 text-right font-label-md text-primary whitespace-nowrap">{fmt(fund.saldo_akhir)}</td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-outline-variant">
                <h4 className="font-label-md text-on-surface uppercase tracking-wide">Detail Transaksi Iuran Disetujui</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Nomor</th>
                      <th className="px-4 py-3">Dana</th>
                      <th className="px-4 py-3">Tipe</th>
                      <th className="px-4 py-3">Kategori</th>
                      <th className="px-4 py-3">Keterangan</th>
                      <th className="px-4 py-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-body-sm">
                    {displayData.transaksi.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-10 text-center text-on-surface-variant">Tidak ada transaksi iuran disetujui pada periode ini.</td></tr>
                    ) : displayData.transaksi.map((trx) => (
                      <tr key={trx.id} className="hover:bg-surface-container-low/50">
                        <td className="px-4 py-2 whitespace-nowrap">{trx.transaction_date}</td>
                        <td className="px-4 py-2 font-mono text-[12px]">{trx.transaction_number}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{trx.dana_name}</td>
                        <td className="px-4 py-2"><Badge label={trx.type === "income" ? "Masuk" : "Keluar"} variant={trx.type === "income" ? "success" : "error"} /></td>
                        <td className="px-4 py-2">{trx.category_name}</td>
                        <td className="px-4 py-2 text-on-surface-variant max-w-[300px] truncate">{trx.description ?? "-"}</td>
                        <td className={`px-4 py-2 text-right font-label-md whitespace-nowrap ${trx.type === "income" ? "text-tertiary" : "text-error"}`}>{fmt(trx.amount)}</td>
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
