"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface Anggota {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: "Aktif" | "Non-Aktif" | "Cuti";
  no_hp: string | null;
  email: string | null;
  alamat: string | null;
  join_date: string;
  tanggal_keluar: string | null;
}

interface PresensiItem {
  kegiatan_id: number;
  judul: string;
  tanggal: string;
  kategori: string;
  lokasi: string | null;
  status: string;
  waktu_hadir: string;
  metode: "QR" | "Manual";
}

interface ArisanItem {
  id: number;
  urutan: number;
  waktu: string;
  kegiatan_id: number;
  kegiatan_judul: string;
  kegiatan_tanggal: string;
  nominal_per_orang: string | null;
}

interface DoorprizeItem {
  id: number;
  waktu: string;
  nama_hadiah: string;
  kegiatan_id: number;
  kegiatan_judul: string;
  kegiatan_tanggal: string;
}

type Tab = "kehadiran" | "arisan" | "doorprize";

const JABATAN_ORDER: Record<string, number> = {
  Ketua: 1, "Wakil Ketua": 2, Sekretaris: 3, Bendahara: 4, Pengurus: 5, Anggota: 6,
};

function getInitials(nama: string) {
  return nama.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

function formatTanggal(s: string) {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function formatWaktu(s: string) {
  if (!s) return "-";
  return new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRupiah(n: string | number | null) {
  if (!n) return "-";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n));
}

function jabatanColor(jabatan: string) {
  const rank = JABATAN_ORDER[jabatan] ?? 6;
  if (rank <= 1) return "bg-primary text-on-primary";
  if (rank <= 4) return "bg-secondary text-on-secondary";
  return "bg-tertiary-container text-on-tertiary-container";
}

export default function AnggotaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [anggota, setAnggota] = useState<Anggota | null>(null);
  const [presensi, setPresensi] = useState<PresensiItem[]>([]);
  const [arisan, setArisan] = useState<ArisanItem[]>([]);
  const [doorprize, setDoorprize] = useState<DoorprizeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [riwayatLoading, setRiwayatLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("kehadiran");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setRiwayatLoading(true);
    try {
      const [angRes, riwRes] = await Promise.all([
        fetch(`/api/anggota/${id}`),
        fetch(`/api/anggota/${id}/riwayat`),
      ]);
      if (!angRes.ok) { setNotFound(true); return; }
      const angData: Anggota = await angRes.json();
      setAnggota(angData);
      setLoading(false);

      if (riwRes.ok) {
        const riwData = await riwRes.json();
        setPresensi(riwData.presensi ?? []);
        setArisan(riwData.arisan ?? []);
        setDoorprize(riwData.doorprize ?? []);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
      setRiwayatLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (notFound) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <span className="material-symbols-outlined text-[72px] opacity-20 mb-4">person_off</span>
          <h2 className="font-h2 text-h2 text-on-surface mb-2">Anggota tidak ditemukan</h2>
          <Link href="/keanggotaan" className="text-primary hover:underline text-body-md mt-2">
            ← Kembali ke Keanggotaan
          </Link>
        </div>
      </AppLayout>
    );
  }

  const statusVariant = anggota?.status === "Aktif" ? "success" as const
    : anggota?.status === "Cuti" ? "warning" as const
    : "neutral" as const;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-label-sm text-on-surface-variant">
          <Link href="/keanggotaan" className="hover:text-primary transition-colors">Keanggotaan</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-on-surface font-medium">
            {loading ? "Memuat..." : anggota?.nama ?? "Profil Anggota"}
          </span>
        </nav>

        {/* Profile Card */}
        <Card className="p-6">
          {loading ? (
            <div className="flex gap-5 animate-pulse">
              <div className="w-20 h-20 rounded-full bg-surface-container-high flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-3">
                <div className="h-6 bg-surface-container-high rounded w-48" />
                <div className="h-4 bg-surface-container-high rounded w-32" />
                <div className="h-4 bg-surface-container-high rounded w-56" />
              </div>
            </div>
          ) : anggota && (
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              {/* Avatar */}
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl flex-shrink-0 ${jabatanColor(anggota.jabatan)}`}>
                {getInitials(anggota.nama)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="font-h2 text-h2 text-on-surface">{anggota.nama}</h1>
                  <Badge label={anggota.status} variant={statusVariant} dot />
                </div>
                <p className="text-body-md text-on-surface-variant mb-3">
                  {anggota.jabatan} &nbsp;·&nbsp; {anggota.unit_kerja}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-body-sm">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">badge</span>
                    <span className="font-mono">{anggota.nip}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                    <span>Bergabung: {formatTanggal(anggota.join_date)}</span>
                  </div>
                  {anggota.no_hp && (
                    <a href={`https://wa.me/${anggota.no_hp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[16px]">phone</span>
                      <span>{anggota.no_hp}</span>
                    </a>
                  )}
                  {anggota.email && (
                    <a href={`mailto:${anggota.email}`}
                      className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[16px]">mail</span>
                      <span>{anggota.email}</span>
                    </a>
                  )}
                  {anggota.alamat && (
                    <div className="flex items-start gap-2 text-on-surface-variant sm:col-span-2">
                      <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">location_on</span>
                      <span>{anggota.alamat}</span>
                    </div>
                  )}
                  {anggota.tanggal_keluar && (
                    <div className="flex items-center gap-2 text-error sm:col-span-2">
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      <span>Keluar: {formatTanggal(anggota.tanggal_keluar)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action */}
              <Link
                href={`/keanggotaan`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container text-label-sm transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Kembali
              </Link>
            </div>
          )}
        </Card>

        {/* Stats Row */}
        {!riwayatLoading && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Kehadiran", value: presensi.length, icon: "how_to_reg", color: "text-primary", bg: "bg-primary-fixed/30" },
              { label: "Menang Arisan", value: arisan.length, icon: "savings", color: "text-secondary", bg: "bg-secondary-fixed/30" },
              { label: "Menang Doorprize", value: doorprize.length, icon: "redeem", color: "text-tertiary", bg: "bg-tertiary-container/40" },
            ].map((s) => (
              <Card key={s.label} className={`p-4 flex items-center gap-3 ${s.bg}`}>
                <span className={`material-symbols-outlined material-symbols-filled text-[28px] ${s.color}`}>{s.icon}</span>
                <div>
                  <p className="font-bold text-2xl text-on-surface leading-none">{s.value}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">{s.label}</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Card>
          {/* Tab bar */}
          <div className="flex border-b border-outline-variant">
            {([
              { key: "kehadiran", label: "Riwayat Kehadiran", icon: "how_to_reg", count: presensi.length },
              { key: "arisan", label: "Kemenangan Arisan", icon: "savings", count: arisan.length },
              { key: "doorprize", label: "Kemenangan Doorprize", icon: "redeem", count: doorprize.length },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-label-md border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${tab === t.key ? "material-symbols-filled" : ""}`}>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
                {!riwayatLoading && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                    tab === t.key ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
                  }`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {riwayatLoading ? (
            <div className="p-12 flex items-center justify-center">
              <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
            </div>
          ) : (
            <>
              {/* Kehadiran */}
              {tab === "kehadiran" && (
                presensi.length === 0 ? (
                  <div className="py-14 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[56px] block mb-3 opacity-20">event_busy</span>
                    <p className="text-body-sm">Belum ada riwayat kehadiran.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low">
                          {["#", "Acara", "Tanggal", "Kategori", "Waktu Hadir", "Metode"].map((h) => (
                            <th key={h} className="px-5 py-3 font-label-md text-label-md text-on-surface-variant border-b border-outline-variant whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/40">
                        {presensi.map((p, i) => (
                          <tr key={`${p.kegiatan_id}-${p.waktu_hadir}`} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-5 py-3 text-on-surface-variant text-body-sm">{i + 1}</td>
                            <td className="px-5 py-3">
                              <Link href={`/kegiatan/${p.kegiatan_id}`} className="font-label-md text-label-md text-on-surface hover:text-primary transition-colors leading-tight block">
                                {p.judul}
                              </Link>
                              {p.lokasi && <p className="text-[11px] text-on-surface-variant">{p.lokasi}</p>}
                            </td>
                            <td className="px-5 py-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatTanggal(p.tanggal)}</td>
                            <td className="px-5 py-3">
                              <Badge label={p.kategori} variant="warning" />
                            </td>
                            <td className="px-5 py-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatWaktu(p.waktu_hadir)}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                p.metode === "QR" ? "bg-tertiary-container text-on-tertiary-container" : "bg-surface-container-high text-on-surface-variant"
                              }`}>
                                <span className="material-symbols-outlined text-[12px]">{p.metode === "QR" ? "qr_code" : "edit"}</span>
                                {p.metode}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Arisan */}
              {tab === "arisan" && (
                arisan.length === 0 ? (
                  <div className="py-14 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[56px] block mb-3 opacity-20">savings</span>
                    <p className="text-body-sm">Belum pernah mendapatkan arisan.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low">
                          {["#", "Acara", "Tanggal Kegiatan", "Nominal", "Waktu Menang"].map((h) => (
                            <th key={h} className="px-5 py-3 font-label-md text-label-md text-on-surface-variant border-b border-outline-variant whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/40">
                        {arisan.map((a, i) => (
                          <tr key={a.id} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-5 py-3">
                              <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-secondary-fixed text-secondary font-bold text-[12px]">
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <Link href={`/kegiatan/${a.kegiatan_id}`} className="font-label-md text-label-md text-on-surface hover:text-primary transition-colors">
                                {a.kegiatan_judul}
                              </Link>
                            </td>
                            <td className="px-5 py-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatTanggal(a.kegiatan_tanggal)}</td>
                            <td className="px-5 py-3 font-medium text-secondary">{formatRupiah(a.nominal_per_orang)}</td>
                            <td className="px-5 py-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatWaktu(a.waktu)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Doorprize */}
              {tab === "doorprize" && (
                doorprize.length === 0 ? (
                  <div className="py-14 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[56px] block mb-3 opacity-20">redeem</span>
                    <p className="text-body-sm">Belum pernah mendapatkan doorprize.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low">
                          {["#", "Hadiah", "Acara", "Tanggal Kegiatan", "Waktu Menang"].map((h) => (
                            <th key={h} className="px-5 py-3 font-label-md text-label-md text-on-surface-variant border-b border-outline-variant whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/40">
                        {doorprize.map((d, i) => (
                          <tr key={d.id} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-5 py-3 text-on-surface-variant text-body-sm">{i + 1}</td>
                            <td className="px-5 py-3">
                              <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined material-symbols-filled text-tertiary text-[18px]">redeem</span>
                                <span className="font-label-md text-label-md text-on-surface">{d.nama_hadiah}</span>
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <Link href={`/kegiatan/${d.kegiatan_id}`} className="text-body-sm text-on-surface hover:text-primary transition-colors">
                                {d.kegiatan_judul}
                              </Link>
                            </td>
                            <td className="px-5 py-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatTanggal(d.kegiatan_tanggal)}</td>
                            <td className="px-5 py-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatWaktu(d.waktu)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
