"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Tarif {
  id: number;
  nominal_anggota: string | number;
  nominal_konsumsi_anggota: string | number;
  nominal_pengurus: string | number;
  periode_mulai: string;
  aktif: number;
  catatan: string | null;
}

interface LaporanRow {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: string;
  join_date: string;
  tanggal_keluar: string | null;
  is_pengurus: boolean;
  iuran_anggota: number;
  iuran_konsumsi_anggota: number;
  iuran_pengurus: number;
  total: number;
  keterangan: string;
}

interface LaporanResponse {
  periode: { bulan: number; tahun: number; awal: string; akhir: string; label: string };
  tarif: { nominal_anggota: number; nominal_konsumsi_anggota: number; nominal_pengurus: number; periode_mulai: string | null } | null;
  rows: LaporanRow[];
  summary: {
    total_anggota_aktif: number;
    total_pengurus_aktif: number;
    total_iuran_anggota: number;
    total_iuran_konsumsi_anggota: number;
    total_iuran_pengurus: number;
    grand_total: number;
  };
}

interface UnitKerjaOption { id: number; nama: string; aktif: number }

const hasValidLaporanRows = (value: unknown): value is LaporanResponse => {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as Partial<LaporanResponse>).rows)
  );
};

// ─── Constants ───────────────────────────────────────────────────────────────
const BULAN_OPTIONS = [
  { v: 1, l: "Januari" }, { v: 2, l: "Februari" }, { v: 3, l: "Maret" },
  { v: 4, l: "April" }, { v: 5, l: "Mei" }, { v: 6, l: "Juni" },
  { v: 7, l: "Juli" }, { v: 8, l: "Agustus" }, { v: 9, l: "September" },
  { v: 10, l: "Oktober" }, { v: 11, l: "November" }, { v: 12, l: "Desember" },
];

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

// ─── Setup Tarif Modal ───────────────────────────────────────────────────────
function TarifModal({
  mode,
  initial,
  onClose,
  onSuccess,
}: {
  mode: "add" | "edit";
  initial?: Tarif;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    nominal_anggota: initial ? String(Number(initial.nominal_anggota)) : "0",
    nominal_konsumsi_anggota: initial ? String(Number(initial.nominal_konsumsi_anggota ?? 0)) : "0",
    nominal_pengurus: initial ? String(Number(initial.nominal_pengurus)) : "0",
    periode_mulai: initial?.periode_mulai?.slice(0, 10) ?? new Date().toISOString().slice(0, 7) + "-01",
    aktif: initial ? initial.aktif : 1,
    catatan: initial?.catatan ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = mode === "edit" && initial ? `/api/iuran/tarif/${initial.id}` : "/api/iuran/tarif";
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nominal_anggota: Number(form.nominal_anggota),
          nominal_konsumsi_anggota: Number(form.nominal_konsumsi_anggota),
          nominal_pengurus: Number(form.nominal_pengurus),
          periode_mulai: form.periode_mulai,
          aktif: form.aktif,
          catatan: form.catatan || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Gagal menyimpan"); return; }
      onSuccess();
    } catch {
      setError("Gagal menyimpan data. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-outline-variant">
        <div className="p-6 border-b border-outline-variant flex items-center justify-between">
          <div>
            <h2 className="font-h3 text-h3 text-on-surface">
              {mode === "add" ? "Tambah Tarif Iuran" : "Edit Tarif Iuran"}
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Tarif berlaku mulai bulan periode yang dipilih.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-0 overflow-y-auto flex-1">
          <div className="p-6 flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-error-container text-error rounded-lg text-body-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-label-md font-semibold text-on-surface">
                Periode Mulai Berlaku <span className="text-error">*</span>
              </label>
              <input
                type="month"
                required
                disabled={mode === "edit"}
                value={form.periode_mulai.slice(0, 7)}
                onChange={(e) => setForm({ ...form, periode_mulai: `${e.target.value}-01` })}
                className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface disabled:opacity-60"
              />
              {mode === "edit" && (
                <p className="text-[11px] text-on-surface-variant">Periode tidak dapat diubah. Hapus &amp; buat baru jika perlu.</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Nominal Iuran Arisan Anggota <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="500"
                  value={form.nominal_anggota}
                  onChange={(e) => setForm({ ...form, nominal_anggota: e.target.value })}
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Iuran Konsumsi Anggota <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="500"
                  value={form.nominal_konsumsi_anggota}
                  onChange={(e) => setForm({ ...form, nominal_konsumsi_anggota: e.target.value })}
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Nominal Iuran Pengurus <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="500"
                  value={form.nominal_pengurus}
                  onChange={(e) => setForm({ ...form, nominal_pengurus: e.target.value })}
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-label-md font-semibold text-on-surface">Status</label>
              <select
                value={form.aktif}
                onChange={(e) => setForm({ ...form, aktif: Number(e.target.value) })}
                style={{ paddingTop: "10px", paddingBottom: "10px" }}
                className="appearance-none border border-outline-variant rounded-lg px-4 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
              >
                <option value={1}>Aktif</option>
                <option value={0}>Nonaktif</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-label-md font-semibold text-on-surface">Catatan</label>
              <input
                type="text"
                value={form.catatan}
                onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                placeholder="Misal: Kenaikan tarif 2026"
                className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
              />
            </div>
          </div>

          <div className="p-6 border-t border-outline-variant flex items-center justify-end gap-3 bg-surface-container">
            <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Tarif"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
type Tab = "laporan" | "tarif";

export default function IuranPage() {
  const now = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<Tab>("laporan");

  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [filterUnit, setFilterUnit] = useState("");
  const [filterPengurus, setFilterPengurus] = useState<"all" | "pengurus" | "anggota">("all");
  const [filterStatus, setFilterStatus] = useState("");

  const [laporan, setLaporan] = useState<LaporanResponse | null>(null);
  const [loadingLaporan, setLoadingLaporan] = useState(false);

  const [unitOptions, setUnitOptions] = useState<UnitKerjaOption[]>([]);

  const [tarifList, setTarifList] = useState<Tarif[]>([]);
  const [loadingTarif, setLoadingTarif] = useState(false);
  const [tarifModal, setTarifModal] = useState<{ mode: "add" | "edit"; data?: Tarif } | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUnits = useCallback(async () => {
    try {
      const r = await fetch("/api/unit-kerja");
      const data: UnitKerjaOption[] = await r.json();
      setUnitOptions(data.filter((u) => u.aktif === 1));
    } catch { /* ignore */ }
  }, []);

  const fetchLaporan = useCallback(async () => {
    setLoadingLaporan(true);
    try {
      const sp = new URLSearchParams({
        bulan: String(bulan),
        tahun: String(tahun),
        pengurus: filterPengurus,
      });
      if (filterUnit) sp.set("unit", filterUnit);
      if (filterStatus) sp.set("status", filterStatus);
      const r = await fetch(`/api/iuran/laporan?${sp}`);
      const json: unknown = await r.json();
      if (!r.ok || !hasValidLaporanRows(json)) {
        throw new Error(
          typeof json === "object" && json && "error" in json && typeof json.error === "string"
            ? json.error
            : "Gagal memuat laporan"
        );
      }
      setLaporan(json);
    } catch (error) {
      setLaporan(null);
      showToast((error as Error).message || "Gagal memuat laporan", "error");
    } finally {
      setLoadingLaporan(false);
    }
  }, [bulan, tahun, filterUnit, filterPengurus, filterStatus]);

  const fetchTarif = useCallback(async () => {
    setLoadingTarif(true);
    try {
      const r = await fetch("/api/iuran/tarif");
      const json = await r.json();
      setTarifList(json.data ?? []);
    } catch {
      showToast("Gagal memuat tarif", "error");
    } finally {
      setLoadingTarif(false);
    }
  }, []);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);
  useEffect(() => { if (tab === "laporan") fetchLaporan(); }, [tab, fetchLaporan]);
  useEffect(() => { if (tab === "tarif") fetchTarif(); }, [tab, fetchTarif]);

  const handleDeleteTarif = async (t: Tarif) => {
    if (!confirm(`Hapus tarif periode ${t.periode_mulai.slice(0, 7)}?`)) return;
    try {
      const r = await fetch(`/api/iuran/tarif/${t.id}`, { method: "DELETE" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      showToast("Tarif dihapus");
      fetchTarif();
    } catch {
      showToast("Gagal menghapus tarif", "error");
    }
  };

  const handleExport = () => {
    const sp = new URLSearchParams({
      bulan: String(bulan), tahun: String(tahun), pengurus: filterPengurus,
    });
    if (filterUnit) sp.set("unit", filterUnit);
    if (filterStatus) sp.set("status", filterStatus);
    window.location.href = `/api/iuran/laporan/export?${sp}`;
  };

  const tahunOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now]);

  return (
    <AppLayout searchPlaceholder="Cari nama atau NIP...">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg font-label-md ${
          toast.type === "success"
            ? "bg-tertiary-container text-on-tertiary-container border border-tertiary-fixed-dim"
            : "bg-error-container text-error border border-error/30"
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      {tarifModal && (
        <TarifModal
          mode={tarifModal.mode}
          initial={tarifModal.data}
          onClose={() => setTarifModal(null)}
          onSuccess={() => {
            const action = tarifModal.mode === "add" ? "Tarif ditambahkan" : "Tarif diperbarui";
            setTarifModal(null);
            fetchTarif();
            showToast(action);
          }}
        />
      )}

      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <nav className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
              <span>Beranda</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-primary font-semibold">Iuran Arisan Anggota</span>
            </nav>
            <h1 className="font-h1 text-h1 text-on-surface mb-2">Iuran Arisan Anggota DWP</h1>
            <p className="text-on-surface-variant text-body-md max-w-2xl">
              Laporan iuran bulanan otomatis berbasis data anggota aktif. Pengurus dikenakan iuran tambahan.
            </p>
          </div>
          {tab === "laporan" && (
            <Button icon="download" size="lg" onClick={handleExport} disabled={!laporan || laporan.rows.length === 0}>
              Export CSV
            </Button>
          )}
          {tab === "tarif" && (
            <Button icon="add" size="lg" onClick={() => setTarifModal({ mode: "add" })}>
              Tambah Tarif
            </Button>
          )}
        </div>

        <div className="flex gap-1 border-b border-outline-variant">
          {([
            { id: "laporan" as Tab, label: "Laporan Bulanan", icon: "summarize" },
            { id: "tarif" as Tab, label: "Setup Tarif", icon: "tune" },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-label-md border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "laporan" && (
          <>
            <Card className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-sm text-on-surface-variant">Bulan</label>
                  <select
                    value={bulan}
                    onChange={(e) => setBulan(Number(e.target.value))}
                    style={{ paddingTop: "10px", paddingBottom: "10px" }}
                    className="appearance-none border border-outline-variant rounded-lg px-3 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                  >
                    {BULAN_OPTIONS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-sm text-on-surface-variant">Tahun</label>
                  <select
                    value={tahun}
                    onChange={(e) => setTahun(Number(e.target.value))}
                    style={{ paddingTop: "10px", paddingBottom: "10px" }}
                    className="appearance-none border border-outline-variant rounded-lg px-3 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                  >
                    {tahunOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-sm text-on-surface-variant">Unit Kerja</label>
                  <select
                    value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value)}
                    style={{ paddingTop: "10px", paddingBottom: "10px" }}
                    className="appearance-none border border-outline-variant rounded-lg px-3 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                  >
                    <option value="">Semua Unit</option>
                    {unitOptions.map((u) => <option key={u.id} value={u.nama}>{u.nama}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-sm text-on-surface-variant">Status Pengurus</label>
                  <select
                    value={filterPengurus}
                    onChange={(e) => setFilterPengurus(e.target.value as "all" | "pengurus" | "anggota")}
                    style={{ paddingTop: "10px", paddingBottom: "10px" }}
                    className="appearance-none border border-outline-variant rounded-lg px-3 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                  >
                    <option value="all">Semua</option>
                    <option value="pengurus">Hanya Pengurus</option>
                    <option value="anggota">Hanya Anggota</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-sm text-on-surface-variant">Status Anggota</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ paddingTop: "10px", paddingBottom: "10px" }}
                    className="appearance-none border border-outline-variant rounded-lg px-3 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                  >
                    <option value="">Semua Status</option>
                    <option value="Aktif">Aktif</option>
                    <option value="Cuti">Cuti</option>
                    <option value="Non-Aktif">Non-Aktif (dengan tgl keluar)</option>
                  </select>
                </div>
              </div>
              {laporan?.tarif && (
                <div className="mt-4 pt-4 border-t border-outline-variant flex flex-wrap items-center gap-x-6 gap-y-2 text-body-sm">
                  <span className="text-on-surface-variant">Tarif berlaku:</span>
                  <span className="text-on-surface">
                    Arisan Anggota <strong>{formatRp(laporan.tarif.nominal_anggota)}</strong>
                  </span>
                  <span className="text-on-surface">
                    Konsumsi Anggota <strong>{formatRp(laporan.tarif.nominal_konsumsi_anggota)}</strong>
                  </span>
                  <span className="text-on-surface">
                    Pengurus <strong>{formatRp(laporan.tarif.nominal_pengurus)}</strong>
                  </span>
                  <span className="text-on-surface-variant text-[12px]">
                    sejak {laporan.tarif.periode_mulai?.slice(0, 7)}
                  </span>
                </div>
              )}
              {laporan && !laporan.tarif && (
                <div className="mt-4 pt-4 border-t border-outline-variant text-error text-body-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  Belum ada tarif iuran yang berlaku untuk periode ini. Tambahkan di tab &ldquo;Setup Tarif&rdquo;.
                </div>
              )}
            </Card>

            {laporan && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <SummaryCard icon="groups" iconBg="bg-primary-fixed" iconColor="text-primary"
                  label="Anggota Aktif" value={String(laporan.summary.total_anggota_aktif)} />
                <SummaryCard icon="shield_person" iconBg="bg-secondary-fixed" iconColor="text-secondary"
                  label="Pengurus Aktif" value={String(laporan.summary.total_pengurus_aktif)} />
                <SummaryCard icon="payments" iconBg="bg-tertiary-fixed" iconColor="text-tertiary"
                  label="Total Iuran Arisan Anggota" value={formatRp(laporan.summary.total_iuran_anggota)} />
                <SummaryCard icon="restaurant" iconBg="bg-tertiary-container" iconColor="text-tertiary"
                  label="Total Konsumsi Anggota" value={formatRp(laporan.summary.total_iuran_konsumsi_anggota)} />
                <SummaryCard icon="account_balance_wallet" iconBg="bg-secondary-container" iconColor="text-secondary"
                  label="Total Iuran Pengurus" value={formatRp(laporan.summary.total_iuran_pengurus)} />
                <SummaryCard icon="paid" iconBg="bg-primary" iconColor="text-on-primary"
                  label="Grand Total" value={formatRp(laporan.summary.grand_total)} highlight />
              </div>
            )}

            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
                <div>
                  <h3 className="font-h3 text-h3 text-on-surface">
                    Laporan {laporan?.periode.label ?? `${BULAN_OPTIONS[bulan - 1].l} ${tahun}`}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">
                    Anggota aktif pada periode terpilih, otomatis dari data keanggotaan.
                  </p>
                </div>
                {laporan && (
                  <span className="text-on-surface-variant text-[12px]">
                    {laporan.rows.length} baris
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead className="bg-surface-container text-on-surface-variant text-label-sm uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">No</th>
                      <th className="px-4 py-3 text-left">Anggota</th>
                      <th className="px-4 py-3 text-left">Unit Kerja</th>
                      <th className="px-4 py-3 text-left">Jabatan</th>
                      <th className="px-4 py-3 text-center">Pengurus</th>
                      <th className="px-4 py-3 text-right">Iuran Arisan Anggota</th>
                      <th className="px-4 py-3 text-right">Konsumsi</th>
                      <th className="px-4 py-3 text-right">Iuran Pengurus</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-left">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {loadingLaporan && (
                      <tr><td colSpan={10} className="px-4 py-10 text-center text-on-surface-variant">Memuat...</td></tr>
                    )}
                    {!loadingLaporan && laporan && laporan.rows.length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-10 text-center text-on-surface-variant">
                        Tidak ada anggota aktif pada periode ini.
                      </td></tr>
                    )}
                    {!loadingLaporan && laporan?.rows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-surface-container/50">
                        <td className="px-4 py-3 text-on-surface-variant">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-on-surface">{r.nama}</div>
                          <div className="text-[11px] text-on-surface-variant font-mono">{r.nip}</div>
                        </td>
                        <td className="px-4 py-3 text-on-surface">{r.unit_kerja}</td>
                        <td className="px-4 py-3 text-on-surface">{r.jabatan}</td>
                        <td className="px-4 py-3 text-center">
                          {r.is_pengurus
                            ? <Badge label="Pengurus" variant="info" />
                            : <span className="text-on-surface-variant">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-on-surface tabular-nums">
                          {formatRp(r.iuran_anggota)}
                        </td>
                        <td className="px-4 py-3 text-right text-on-surface tabular-nums">
                          {r.iuran_konsumsi_anggota > 0 ? formatRp(r.iuran_konsumsi_anggota) : <span className="text-on-surface-variant">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-on-surface tabular-nums">
                          {r.iuran_pengurus > 0 ? formatRp(r.iuran_pengurus) : <span className="text-on-surface-variant">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-primary tabular-nums">
                          {formatRp(r.total)}
                        </td>
                        <td className="px-4 py-3">
                          {r.keterangan.startsWith("Keluar") ? (
                            <Badge label={r.keterangan} variant="warning" />
                          ) : r.status === "Cuti" ? (
                            <Badge label="Cuti" variant="neutral" />
                          ) : (
                            <Badge label="Aktif" variant="success" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {laporan && laporan.rows.length > 0 && (
                    <tfoot className="bg-surface-container font-semibold">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-right text-on-surface-variant uppercase text-label-sm tracking-wider">Total</td>
                        <td className="px-4 py-3 text-right text-on-surface tabular-nums">{formatRp(laporan.summary.total_iuran_anggota)}</td>
                        <td className="px-4 py-3 text-right text-on-surface tabular-nums">{formatRp(laporan.summary.total_iuran_konsumsi_anggota)}</td>
                        <td className="px-4 py-3 text-right text-on-surface tabular-nums">{formatRp(laporan.summary.total_iuran_pengurus)}</td>
                        <td className="px-4 py-3 text-right text-primary tabular-nums">{formatRp(laporan.summary.grand_total)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          </>
        )}

        {tab === "tarif" && (
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant">
              <h3 className="font-h3 text-h3 text-on-surface">Daftar Tarif Iuran</h3>
              <p className="text-body-sm text-on-surface-variant">
                Tarif berlaku mulai bulan periode yang dipilih, sampai ada tarif baru atau dinonaktifkan.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead className="bg-surface-container text-on-surface-variant text-label-sm uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Periode Mulai</th>
                    <th className="px-4 py-3 text-right">Iuran Arisan Anggota</th>
                    <th className="px-4 py-3 text-right">Konsumsi Anggota</th>
                    <th className="px-4 py-3 text-right">Iuran Pengurus</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Catatan</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {loadingTarif && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-on-surface-variant">Memuat...</td></tr>
                  )}
                  {!loadingTarif && tarifList.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-on-surface-variant">
                      Belum ada tarif. Klik &ldquo;Tambah Tarif&rdquo; untuk membuat.
                    </td></tr>
                  )}
                  {!loadingTarif && tarifList.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-container/50">
                      <td className="px-4 py-3 font-semibold text-on-surface">{t.periode_mulai.slice(0, 7)}</td>
                      <td className="px-4 py-3 text-right text-on-surface tabular-nums">{formatRp(Number(t.nominal_anggota))}</td>
                      <td className="px-4 py-3 text-right text-on-surface tabular-nums">{formatRp(Number(t.nominal_konsumsi_anggota ?? 0))}</td>
                      <td className="px-4 py-3 text-right text-on-surface tabular-nums">{formatRp(Number(t.nominal_pengurus))}</td>
                      <td className="px-4 py-3">
                        {t.aktif ? <Badge label="Aktif" variant="success" /> : <Badge label="Nonaktif" variant="neutral" />}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{t.catatan ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setTarifModal({ mode: "edit", data: t })}
                            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteTarif(t)}
                            className="p-2 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error"
                            title="Hapus"
                          >
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
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  icon, iconBg, iconColor, label, value, highlight,
}: {
  icon: string; iconBg: string; iconColor: string; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className={`p-5 rounded-xl border shadow-sm ${
      highlight
        ? "bg-primary text-on-primary border-primary"
        : "bg-surface-container-lowest border-outline-variant"
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 ${iconBg} rounded-lg ${iconColor}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <span className={`text-label-sm uppercase tracking-wider ${
          highlight ? "text-on-primary/90" : "text-on-surface-variant"
        }`}>{label}</span>
      </div>
      <p className={`font-h3 text-h3 leading-tight ${highlight ? "text-on-primary" : "text-on-surface"}`}>
        {value}
      </p>
    </div>
  );
}
