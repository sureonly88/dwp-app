"use client";

import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { FetchErrorBox } from "@/components/ui/FetchError";

interface Preview {
  periode: { bulan: number; tahun: number; awal: string; akhir: string; label: string };
  summary: {
    total_anggota_aktif: number; total_pengurus_aktif: number;
    total_iuran_anggota: number; total_iuran_konsumsi_anggota: number; total_iuran_pengurus: number; grand_total: number;
  };
  tarif: { nominal_anggota: number; nominal_konsumsi_anggota: number; nominal_pengurus: number } | null;
  posting: {
    iuran_anggota: { amount: number; jumlah_anggota: number; existing: ExistingPost | null };
    iuran_konsumsi_anggota: { amount: number; jumlah_anggota: number; existing: ExistingPost | null };
    iuran_pengurus: { amount: number; jumlah_pengurus: number; existing: ExistingPost | null };
  };
}
interface ExistingPost { id: number; transaction_number: string; status: string; transaction_date: string; amount: number }

const fmt = (n: number) => "Rp " + (n ?? 0).toLocaleString("id-ID");
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const getMonthEndDate = (bulan: number, tahun: number) => {
  const lastDay = new Date(tahun, bulan, 0).getDate();
  return `${tahun}-${pad2(bulan)}-${pad2(lastDay)}`;
};
const getMonthStartDate = (bulan: number, tahun: number) => `${tahun}-${pad2(bulan)}-01`;

export default function PostingIuranPage() {
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [tanggalPosting, setTanggalPosting] = useState(() => getMonthEndDate(now.getMonth() + 1, now.getFullYear()));
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true); setFetchError(false);
    try {
      const res = await fetch(`/api/kas/posting-iuran?bulan=${bulan}&tahun=${tahun}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { setFetchError(true); } finally { setLoading(false); }
  }, [bulan, tahun]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleBulanChange = (value: number) => {
    setBulan(value);
    setTanggalPosting(getMonthEndDate(value, tahun));
  };

  const handleTahunChange = (value: number) => {
    setTahun(value);
    setTanggalPosting(getMonthEndDate(bulan, value));
  };

  const post = async (jenis: "anggota" | "konsumsi" | "pengurus" | "both") => {
    if (!tanggalPosting) {
      showToast("Tanggal posting wajib diisi", "error");
      return;
    }
    if (!confirm(`Posting iuran ${jenis} untuk ${MONTHS[bulan-1]} ${tahun} pada ${tanggalPosting}?`)) return;
    setPosting(true);
    try {
      const res = await fetch("/api/kas/posting-iuran", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulan, tahun, jenis, tanggal: tanggalPosting }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const c = json.created.length, s = json.skipped.length;
      showToast(`${c} transaksi dibuat${s ? `, ${s} dilewati` : ""}`);
      load();
    } catch (e) { showToast((e as Error).message ?? "Gagal posting", "error"); }
    finally { setPosting(false); }
  };

  return (
    <AppLayout>
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg ${toast.type === "success" ? "bg-tertiary-container text-on-tertiary-container" : "bg-error-container text-error"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-h2 text-h2 text-primary">Posting Iuran ke Kas</h2>
          <p className="text-body-sm text-on-surface-variant">Membuat transaksi rekap iuran bulanan ke modul kas (per periode, bukan per anggota).</p>
        </div>

        <Card className="p-6">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <label className="text-label-sm text-on-surface-variant">Tanggal
              <input type="date" value={tanggalPosting}
                min={getMonthStartDate(bulan, tahun)}
                max={getMonthEndDate(bulan, tahun)}
                onChange={(e) => setTanggalPosting(e.target.value)}
                className="mt-1 block px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none" />
            </label>
            <label className="text-label-sm text-on-surface-variant">Bulan
              <select value={bulan} onChange={(e) => handleBulanChange(Number(e.target.value))}
                style={{ paddingTop: '10px', paddingBottom: '10px' }}
                className="mt-1 block appearance-none px-3 border border-outline-variant rounded-lg bg-surface text-body-sm focus:border-primary focus:outline-none text-on-surface">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label className="text-label-sm text-on-surface-variant">Tahun
              <input type="number" value={tahun} min={2000} max={2100} onChange={(e) => handleTahunChange(Number(e.target.value))}
                className="mt-1 block px-3 py-2.5 border border-outline-variant rounded-lg bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none w-28" />
            </label>
            <button onClick={load} className="px-4 py-2 border border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-container">
              Muat Ulang
            </button>
          </div>

          {fetchError ? <FetchErrorBox onRetry={load} /> :
           loading || !data ? <p className="py-8 text-center text-on-surface-variant">Memuat...</p> : (
            <>
              <div className="bg-surface-container-low p-4 rounded-xl mb-4">
                <p className="text-label-sm text-on-surface-variant">Periode</p>
                <p className="font-h3 text-h3 text-on-surface">{data.periode.label}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-3 text-body-sm">
                  <div><span className="text-on-surface-variant">Anggota aktif:</span> <b>{data.summary.total_anggota_aktif}</b></div>
                  <div><span className="text-on-surface-variant">Pengurus aktif:</span> <b>{data.summary.total_pengurus_aktif}</b></div>
                  <div><span className="text-on-surface-variant">Tarif arisan anggota:</span> <b>{data.tarif ? fmt(data.tarif.nominal_anggota) : "-"}</b></div>
                  <div><span className="text-on-surface-variant">Tarif konsumsi anggota:</span> <b>{data.tarif ? fmt(data.tarif.nominal_konsumsi_anggota) : "-"}</b></div>
                  <div><span className="text-on-surface-variant">Tarif pengurus:</span> <b>{data.tarif ? fmt(data.tarif.nominal_pengurus) : "-"}</b></div>
                  <div><span className="text-on-surface-variant">Total iuran:</span> <b>{fmt(data.summary.grand_total)}</b></div>
                </div>
              </div>

              {!data.tarif && (
                <div className="flex items-center gap-2 p-3 mb-2 bg-error-container text-error rounded-lg text-body-sm">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  Tarif iuran belum dikonfigurasi untuk periode ini. Silakan tambahkan tarif di menu <b>Iuran &gt; Tarif</b>.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {([
                  { key: "anggota", label: "Arisan Anggota", item: data.posting.iuran_anggota, jumlah: data.posting.iuran_anggota.jumlah_anggota, satuan: "anggota" },
                  { key: "konsumsi", label: "Konsumsi Anggota", item: data.posting.iuran_konsumsi_anggota, jumlah: data.posting.iuran_konsumsi_anggota.jumlah_anggota, satuan: "anggota" },
                  { key: "pengurus", label: "Pengurus", item: data.posting.iuran_pengurus, jumlah: data.posting.iuran_pengurus.jumlah_pengurus, satuan: "pengurus" },
                ] as const).map(({ key, label, item, jumlah, satuan }) => {
                  return (
                    <Card key={key} className="p-5 border border-outline-variant" hover={false}>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-label-md text-on-surface uppercase tracking-wide">Iuran {label}</h4>
                        {item.existing ? <Badge label={`Sudah diposting (${item.existing.status})`} variant="success" dot /> : <Badge label="Belum diposting" variant="warning" />}
                      </div>
                      <p className="text-body-sm text-on-surface-variant">{jumlah} {satuan}</p>
                      {key === "konsumsi" && (
                        <p className="text-[11px] text-on-surface-variant mt-1">
                          Diposting terpisah agar tampil di laporan bulanan kas.
                        </p>
                      )}
                      <p className="font-h2 text-h2 text-tertiary mt-1">{fmt(item.amount)}</p>
                      {item.existing && (
                        <p className="text-[11px] text-on-surface-variant mt-2 font-mono">
                          Trx: {item.existing.transaction_number} ({item.existing.transaction_date})
                        </p>
                      )}
                      <button onClick={() => post(key)} disabled={posting || !!item.existing || item.amount <= 0}
                        className="mt-3 w-full px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md hover:bg-primary-container disabled:opacity-40">
                        {item.existing ? "Sudah diposting" : `Posting Iuran ${label}`}
                      </button>
                    </Card>
                  );
                })}
                <Card className="p-5 border border-outline-variant bg-tertiary-container" hover={false}>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-label-md text-on-tertiary-container uppercase tracking-wide">Total Iuran</h4>
                    <Badge label="Anggota + Konsumsi + Pengurus" variant="info" />
                  </div>
                  <p className="text-body-sm text-on-tertiary-container/80">Total iuran arisan anggota, konsumsi anggota, dan iuran pengurus</p>
                  <p className="font-h2 text-h2 text-on-tertiary-container mt-1">
                    {fmt(data.summary.grand_total)}
                  </p>
                </Card>
              </div>

              <div className="mt-4 flex justify-end">
                <button onClick={() => post("both")} disabled={posting}
                  className="px-5 py-2.5 bg-tertiary text-on-tertiary rounded-xl font-label-md inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-40">
                  <span className="material-symbols-outlined text-[18px]">post_add</span>
                  Posting Semua (Anggota + Konsumsi + Pengurus)
                </button>
              </div>

              <p className="text-[11px] text-on-surface-variant mt-3">
                Posting bersifat idempoten — jika sudah pernah diposting untuk periode ini, akan dilewati. Transaksi yang dibuat berstatus <b>Menunggu</b> dan baru menambah saldo setelah disetujui di menu Transaksi Kas.
              </p>
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
