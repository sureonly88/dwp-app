"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { FetchErrorBox } from "@/components/ui/FetchError";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardStats {
  total_anggota: number;
  anggota_aktif: number;
  anggota_non_aktif: number;
  anggota_cuti: number;
  pengurus_aktif: number;
  unit_kerja_aktif: number;
  kegiatan_bulan_ini: number;
  estimasi_iuran_bulan_ini: number;
  pensiun_tahun_berjalan: number;
  pensiun_sudah_terjadi: number;
  pensiun_akan_datang: number;
}

interface UpcomingItem {
  id: number;
  judul: string;
  tanggal: string;
  waktu_mulai: string | null;
  lokasi: string | null;
  kategori: string;
  status: string;
  hadir: number;
  target: number | null;
}

interface RecentAnggota {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: string;
  join_date: string;
}

interface PensiunAnggota {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: string;
  tanggal_pensiun: string;
}

interface BirthdayAnggota {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: string;
  tanggal_lahir: string;
}

interface UnitDist {
  unit: string;
  total: number;
  aktif: number;
}

interface KegiatanHistory {
  label: string;
  bulan_key: string;
  jumlah_kegiatan: number;
  total_hadir: number;
}

interface AttendanceHighlightItem {
  anggota_id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status_keanggotaan: "Istri Karyawan" | "Karyawati" | "Pengurus";
  kegiatan_id: number;
  judul: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_hadir: string;
}

interface DashboardData {
  stats: DashboardStats;
  upcoming: UpcomingItem[];
  recent_anggota: RecentAnggota[];
  pensiun_anggota: PensiunAnggota[];
  unit_dist: UnitDist[];
  kegiatan_history: KegiatanHistory[];
  ulang_tahun_bulan_ini: BirthdayAnggota[];
  attendance_highlights: {
    lebih_awal: {
      istri_karyawan: AttendanceHighlightItem[];
      karyawati: AttendanceHighlightItem[];
    };
    tepat_waktu: {
      istri_karyawan: AttendanceHighlightItem[];
      karyawati: AttendanceHighlightItem[];
    };
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const formatTanggal = (s: string) =>
  new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

const formatTanggalUlangTahun = (s: string) =>
  new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long" });

const formatWaktu = (s: string) =>
  new Date(s).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function statusKegiatanBadge(s: string) {
  if (s === "Mendatang") return <Badge label="Mendatang" variant="info" />;
  if (s === "Berlangsung") return <Badge label="Berlangsung" variant="warning" />;
  if (s === "Selesai") return <Badge label="Selesai" variant="success" />;
  return <Badge label={s} variant="neutral" />;
}

function statusAnggotaBadge(s: string) {
  if (s === "Aktif") return <Badge label="Aktif" variant="success" />;
  if (s === "Cuti") return <Badge label="Cuti" variant="warning" />;
  return <Badge label="Non-Aktif" variant="error" />;
}

function AttendanceStatusSection({
  title,
  items,
}: {
  title: string;
  items: AttendanceHighlightItem[];
}) {
  return (
    <div className="bg-surface-container-low rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-label-md font-semibold text-on-surface">{title}</h3>
        <Badge label={`${items.length} orang`} variant="info" />
      </div>
      {items.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">Belum ada data kehadiran yang sesuai.</p>
      ) : (
        <div className="flex flex-col divide-y divide-outline-variant/50">
          {items.map((item) => (
            <div key={`${title}-${item.kegiatan_id}-${item.anggota_id}-${item.waktu_hadir}`} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-on-surface truncate">{item.nama}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">{item.jabatan} · {item.unit_kerja}</p>
                  <p className="text-[11px] text-on-surface-variant truncate mt-1">{item.judul}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-body-sm font-medium text-on-surface">{formatWaktu(item.waktu_hadir)}</p>
                  <p className="text-[11px] text-on-surface-variant">{formatTanggal(item.tanggal)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function SCard({
  icon, iconBg, iconColor, label, value, sub, accent,
}: {
  icon: string; iconBg: string; iconColor: string;
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`bg-surface-container-lowest border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow ${
      accent ? "border-l-4 border-l-primary border-t border-r border-b border-outline-variant" : "border-outline-variant"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 ${iconBg} rounded-lg ${iconColor}`}>
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
      </div>
      <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">{label}</p>
      <p className="font-h2 text-h2 text-on-surface mt-0.5 leading-tight">{value}</p>
      {sub && <p className="text-label-sm text-on-surface-variant mt-1">{sub}</p>}
    </div>
  );
}

// ─── Bar chart ───────────────────────────────────────────────────────────────
function SimpleBarChart({ data }: { data: KegiatanHistory[] }) {
  const maxHadir = Math.max(...data.map((d) => Number(d.total_hadir)), 1);
  return (
    <div className="flex items-end gap-3 h-40 px-2">
      {data.map((d) => {
        const pct = (Number(d.total_hadir) / maxHadir) * 100;
        return (
          <div key={d.bulan_key} className="flex-1 flex flex-col items-center gap-1.5 group relative">
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-on-surface text-surface text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {d.total_hadir} hadir · {d.jumlah_kegiatan} kegiatan
            </div>
            <div className="w-full rounded-t-md overflow-hidden bg-surface-container-high" style={{ height: "120px" }}>
              <div
                className="w-full bg-primary/70 group-hover:bg-primary transition-colors rounded-t-md"
                style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant text-center leading-tight">{d.label}</span>
          </div>
        );
      })}
      {data.length === 0 && (
        <p className="w-full text-center text-on-surface-variant text-body-sm">Belum ada data kegiatan.</p>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const loadDashboard = () => {
    setFetchError(false);
    setLoading(true);
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => { loadDashboard(); }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const now = new Date();
  const greetHour = now.getHours();
  const salam =
    greetHour < 10 ? "Selamat Pagi" : greetHour < 15 ? "Selamat Siang" : greetHour < 18 ? "Selamat Sore" : "Selamat Malam";
  const todayStr = `${HARI[now.getDay()]}, ${now.getDate()} ${BULAN_FULL[now.getMonth()]} ${now.getFullYear()}`;

  const stats = data?.stats;

  return (
    <AppLayout searchPlaceholder="Cari data...">
      <div className="flex flex-col gap-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">{todayStr}</p>
            <h1 className="font-h1 text-h1 text-on-surface leading-tight">{salam}, Pengurus DWP</h1>
            <p className="text-body-lg text-on-surface-variant mt-1">
              Ringkasan data sistem keanggotaan dan kegiatan terkini.
            </p>
          </div>
          <Link
            href="/kegiatan"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary/90 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tambah Kegiatan
          </Link>
        </header>

        {fetchError && (
          <FetchErrorBox message="Gagal memuat data dashboard. Periksa koneksi dan coba lagi." onRetry={loadDashboard} />
        )}

        {/* Summary Stats (4 cards) */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SCard
              icon="groups" iconBg="bg-primary-fixed" iconColor="text-primary"
              label="Total Anggota"
              value={loading ? "..." : String(stats?.total_anggota ?? 0)}
              sub={loading ? "" : `${stats?.anggota_aktif ?? 0} aktif · ${stats?.anggota_cuti ?? 0} cuti`}
            />
            <SCard
              icon="shield_person" iconBg="bg-secondary-fixed" iconColor="text-secondary"
              label="Pengurus Aktif"
              value={loading ? "..." : String(stats?.pengurus_aktif ?? 0)}
              sub={`dari ${stats?.unit_kerja_aktif ?? "..."} unit kerja`}
            />
            <SCard
              icon="event_available" iconBg="bg-tertiary-fixed" iconColor="text-tertiary"
              label="Kegiatan Bulan Ini"
              value={loading ? "..." : String(stats?.kegiatan_bulan_ini ?? 0)}
              sub={BULAN_FULL[now.getMonth()]}
            />
            <SCard
              icon="account_balance_wallet" iconBg="bg-primary-fixed" iconColor="text-primary"
              label="Estimasi Iuran Bulan Ini"
              value={loading ? "..." : formatRp(stats?.estimasi_iuran_bulan_ini ?? 0)}
              sub="berdasarkan tarif aktif"
              accent
            />
          </div>
        </section>

        {!loading && stats && (
          <section>
            <Card>
              <div className="p-5 border-b border-outline-variant flex items-center justify-between">
                <div>
                  <h2 className="font-h3 text-h3 text-on-surface">Monitoring Pensiun Anggota</h2>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Diambil dari tanggal pensiun anggota pada tahun berjalan</p>
                </div>
                <Badge label={String(stats.pensiun_tahun_berjalan)} variant="info" />
              </div>
              <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">Total Tahun Ini</p>
                  <p className="font-h2 text-h2 text-on-surface mt-1">{stats.pensiun_tahun_berjalan}</p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">Sudah Pensiun</p>
                  <p className="font-h2 text-h2 text-error mt-1">{stats.pensiun_sudah_terjadi}</p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">Akan Datang</p>
                  <p className="font-h2 text-h2 text-tertiary mt-1">{stats.pensiun_akan_datang}</p>
                </div>
              </div>
              <div className="px-5 pb-5">
                {(data?.pensiun_anggota ?? []).length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant">Tidak ada anggota dengan tanggal pensiun di tahun ini.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant">
                          <th className="py-2 pr-4">Nama</th>
                          <th className="py-2 pr-4">Jabatan</th>
                          <th className="py-2 pr-4">Unit</th>
                          <th className="py-2 pr-4">Tanggal Pensiun</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {(data?.pensiun_anggota ?? []).map((anggota) => (
                          <tr key={anggota.id} className="text-body-sm">
                            <td className="py-2 pr-4">
                              <div>
                                <p className="text-on-surface font-medium">{anggota.nama}</p>
                                <p className="text-[11px] text-on-surface-variant font-mono">{anggota.nip}</p>
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-on-surface-variant">{anggota.jabatan}</td>
                            <td className="py-2 pr-4 text-on-surface-variant">{anggota.unit_kerja}</td>
                            <td className="py-2 pr-4 text-on-surface whitespace-nowrap">{formatTanggal(anggota.tanggal_pensiun)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </section>
        )}

        {!loading && (
          <section>
            <Card>
              <div className="p-5 border-b border-outline-variant flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-h3 text-h3 text-on-surface">Ulang Tahun Bulan Ini</h2>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">
                    Daftar anggota aktif yang berulang tahun pada bulan {BULAN_FULL[now.getMonth()]}.
                  </p>
                </div>
                <Badge label={`${data?.ulang_tahun_bulan_ini?.length ?? 0} orang`} variant="info" />
              </div>
              <div className="p-5">
                {(data?.ulang_tahun_bulan_ini ?? []).length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant">
                    Tidak ada anggota yang berulang tahun pada bulan {BULAN_FULL[now.getMonth()]}.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {(data?.ulang_tahun_bulan_ini ?? []).map((anggota) => (
                      <Link
                        key={anggota.id}
                        href={`/keanggotaan/${anggota.id}`}
                        className="flex items-start gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-secondary-fixed text-secondary flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold uppercase leading-none">
                            {BULAN_FULL[new Date(anggota.tanggal_lahir).getMonth()]?.slice(0, 3)}
                          </span>
                          <span className="text-xl font-bold leading-tight">
                            {new Date(anggota.tanggal_lahir).getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-body-md font-semibold text-on-surface truncate">{anggota.nama}</p>
                              <p className="text-label-sm text-on-surface-variant truncate">{anggota.jabatan} · {anggota.unit_kerja}</p>
                            </div>
                            <div className="shrink-0">
                              {statusAnggotaBadge(anggota.status)}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-on-surface-variant">
                            <span className="font-mono">{anggota.nip}</span>
                            <span className="inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">cake</span>
                              {formatTanggalUlangTahun(anggota.tanggal_lahir)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </section>
        )}

        {/* Anggota breakdown row */}
        {!loading && stats && (
          <section>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Aktif", val: stats.anggota_aktif, total: stats.total_anggota, color: "bg-tertiary" },
                { label: "Cuti", val: stats.anggota_cuti, total: stats.total_anggota, color: "bg-secondary" },
                { label: "Non-Aktif", val: stats.anggota_non_aktif, total: stats.total_anggota, color: "bg-error" },
              ].map((row) => {
                const pct = stats.total_anggota ? Math.round((row.val / stats.total_anggota) * 100) : 0;
                return (
                  <div key={row.label} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-wide">{row.label}</span>
                        <span className="text-label-sm text-on-surface-variant">{pct}%</span>
                      </div>
                      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                        <div className={`h-full ${row.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-h3 text-h3 text-on-surface leading-none">{row.val}</p>
                      <p className="text-label-sm text-on-surface-variant">anggota</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {!loading && data?.attendance_highlights && (
          <section>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <div className="p-5 border-b border-outline-variant">
                  <h2 className="font-h3 text-h3 text-on-surface">Anggota Hadir Lebih Awal</h2>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Hadir sebelum waktu mulai pada kegiatan yang sedang berlangsung, masing-masing 5 orang terbaru</p>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AttendanceStatusSection title="Istri Karyawan" items={data.attendance_highlights.lebih_awal.istri_karyawan} />
                  <AttendanceStatusSection title="Karyawati" items={data.attendance_highlights.lebih_awal.karyawati} />
                </div>
              </Card>

              <Card>
                <div className="p-5 border-b border-outline-variant">
                  <h2 className="font-h3 text-h3 text-on-surface">Anggota Hadir Tepat Waktu</h2>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Hadir dari waktu mulai sampai 30 menit sesudahnya pada kegiatan yang sedang berlangsung, masing-masing 5 orang terbaru</p>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AttendanceStatusSection title="Istri Karyawan" items={data.attendance_highlights.tepat_waktu.istri_karyawan} />
                  <AttendanceStatusSection title="Karyawati" items={data.attendance_highlights.tepat_waktu.karyawati} />
                </div>
              </Card>
            </div>
          </section>
        )}

        {/* Chart + Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kegiatan history chart */}
          <section className="lg:col-span-2">
            <Card>
              <div className="p-5 border-b border-outline-variant flex items-center justify-between">
                <div>
                  <h2 className="font-h3 text-h3 text-on-surface">Statistik Kehadiran</h2>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Jumlah hadir per kegiatan, 6 bulan terakhir</p>
                </div>
                <Link href="/kegiatan" className="text-label-md text-primary hover:underline flex items-center gap-1">
                  Lihat Semua
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
              <div className="p-6">
                {loading
                  ? <div className="h-40 flex items-center justify-center text-on-surface-variant">Memuat...</div>
                  : <SimpleBarChart data={data?.kegiatan_history ?? []} />
                }
              </div>
            </Card>
          </section>

          {/* Upcoming kegiatan */}
          <section>
            <Card className="h-full flex flex-col">
              <div className="p-5 border-b border-outline-variant flex items-center justify-between">
                <div>
                  <h2 className="font-h3 text-h3 text-on-surface">Kegiatan Terbaru</h2>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">7 hari terakhir & mendatang</p>
                </div>
              </div>
              <div className="divide-y divide-outline-variant flex-1">
                {loading && (
                  <div className="p-5 text-on-surface-variant text-body-sm">Memuat...</div>
                )}
                {!loading && (data?.upcoming ?? []).length === 0 && (
                  <div className="p-5 text-on-surface-variant text-body-sm">Belum ada kegiatan terdaftar.</div>
                )}
                {!loading && (data?.upcoming ?? []).map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/kegiatan/${ev.id}`}
                    className="flex gap-3 items-start p-4 hover:bg-surface-container-low transition-colors group block"
                  >
                    <div className="p-2 bg-primary-fixed text-primary rounded-lg shrink-0 flex flex-col items-center min-w-[42px]">
                      <span className="text-[10px] font-bold leading-none uppercase">
                        {BULAN_FULL[new Date(ev.tanggal).getMonth()]?.slice(0, 3)}
                      </span>
                      <span className="text-[18px] font-bold leading-tight">{new Date(ev.tanggal).getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-on-surface text-body-sm group-hover:text-primary transition-colors truncate">{ev.judul}</p>
                      {ev.lokasi && (
                        <p className="text-label-sm text-on-surface-variant flex items-center gap-1 mt-0.5 truncate">
                          <span className="material-symbols-outlined text-[12px]">location_on</span>
                          {ev.lokasi}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {statusKegiatanBadge(ev.status)}
                        <span className="text-label-sm text-on-surface-variant">{ev.hadir} hadir</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="p-4 border-t border-outline-variant">
                <Link href="/kegiatan" className="text-label-md text-primary hover:underline w-full text-center block">
                  Lihat Semua Kegiatan →
                </Link>
              </div>
            </Card>
          </section>
        </div>

        {/* Bottom: unit distribution + recent anggota */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Per-unit bar */}
          <section>
            <Card>
              <div className="p-5 border-b border-outline-variant flex items-center justify-between">
                <div>
                  <h2 className="font-h3 text-h3 text-on-surface">Sebaran per Unit Kerja</h2>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Jumlah anggota aktif tiap unit</p>
                </div>
                <Link href="/unit-kerja" className="text-label-md text-primary hover:underline flex items-center gap-1">
                  Unit Kerja
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {loading && <p className="text-on-surface-variant text-body-sm">Memuat...</p>}
                {!loading && (data?.unit_dist ?? []).map((u) => {
                  const maxTotal = Math.max(...(data?.unit_dist ?? []).map((x) => x.total), 1);
                  const pct = Math.round((u.aktif / maxTotal) * 100);
                  return (
                    <div key={u.unit} className="flex items-center gap-3">
                      <span className="text-body-sm text-on-surface w-36 shrink-0 truncate">{u.unit}</span>
                      <div className="flex-1 h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-label-sm text-on-surface-variant w-16 text-right shrink-0">
                        {u.aktif}/{u.total}
                      </span>
                    </div>
                  );
                })}
                {!loading && (data?.unit_dist ?? []).length === 0 && (
                  <p className="text-on-surface-variant text-body-sm">Belum ada data unit.</p>
                )}
              </div>
            </Card>
          </section>

          {/* Recent anggota */}
          <section>
            <Card>
              <div className="p-5 border-b border-outline-variant flex items-center justify-between">
                <div>
                  <h2 className="font-h3 text-h3 text-on-surface">Anggota Terbaru</h2>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Berdasarkan tanggal bergabung</p>
                </div>
                <Link href="/keanggotaan" className="text-label-md text-primary hover:underline flex items-center gap-1">
                  Keanggotaan
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
              <div className="divide-y divide-outline-variant">
                {loading && <div className="p-5 text-on-surface-variant text-body-sm">Memuat...</div>}
                {!loading && (data?.recent_anggota ?? []).map((a) => {
                  const initials = a.nama.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
                  const bgColors = ["bg-primary-fixed text-primary", "bg-secondary-fixed text-secondary", "bg-tertiary-fixed text-tertiary"];
                  const bg = bgColors[a.id % bgColors.length];
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-4 hover:bg-surface-container-low transition-colors">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-label-sm shrink-0 ${bg}`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-on-surface text-body-sm truncate">{a.nama}</p>
                        <p className="text-label-sm text-on-surface-variant truncate">{a.jabatan} · {a.unit_kerja}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {statusAnggotaBadge(a.status)}
                        <p className="text-[11px] text-on-surface-variant mt-1">{formatTanggal(a.join_date)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        </div>

        {/* Quick links */}
        <section>
          <h2 className="font-h3 text-h3 text-on-surface mb-4">Akses Cepat</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { href: "/keanggotaan", icon: "group_add", label: "Kelola Anggota", color: "bg-primary-fixed text-primary" },
              { href: "/iuran", icon: "account_balance_wallet", label: "Laporan Iuran", color: "bg-secondary-fixed text-secondary" },
              { href: "/arisan", icon: "savings", label: "Undian Arisan", color: "bg-tertiary-fixed text-tertiary" },
              { href: "/akun", icon: "lock_reset", label: "Ubah Password", color: "bg-secondary-container text-secondary" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-3 p-5 bg-surface-container-lowest border border-outline-variant rounded-xl hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div className={`p-3 rounded-xl ${item.color} group-hover:scale-110 transition-transform`}>
                  <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
                </div>
                <span className="text-label-md font-semibold text-on-surface text-center">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </AppLayout>
  );
}

