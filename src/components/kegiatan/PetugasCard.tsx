"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import type { PetugasKegiatan } from "@/lib/kegiatan-petugas";

interface Props {
  kegiatanId: string;
  revisi: number;
  revisiPresensi: number;
  isAdmin: boolean;
}

export default function PetugasCard({ kegiatanId, revisi, revisiPresensi, isAdmin }: Props) {
  const endpoint = `/api/kegiatan/${kegiatanId}/petugas`;
  const [petugas, setPetugas] = useState<PetugasKegiatan[] | null>(null);
  const [muatGagal, setMuatGagal] = useState(false);
  const [muatUlang, setMuatUlang] = useState(0);
  const [mencari, setMencari] = useState(false);
  const [query, setQuery] = useState("");
  const [hasil, setHasil] = useState<{ kataKunci: string; data: PetugasKegiatan[]; gagal?: boolean } | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState<{ teks: string; gagal?: boolean } | null>(null);
  const kataKunci = query.trim();
  const hasilTerkini = hasil?.kataKunci === kataKunci ? hasil : null;

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        if (!controller.signal.aborted) {
          setPetugas(data);
          setMuatGagal(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setMuatGagal(true);
      });
    return () => controller.abort();
  }, [endpoint, revisi, muatUlang]);

  useEffect(() => {
    if (!mencari || kataKunci.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: kataKunci });
        const res = await fetch(`${endpoint}?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        if (!controller.signal.aborted) setHasil({ kataKunci, data });
      } catch {
        if (!controller.signal.aborted) setHasil({ kataKunci, data: [], gagal: true });
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [endpoint, kataKunci, mencari, revisiPresensi]);

  const ubahPetugas = async (anggotaId: number, nama: string, method: "PUT" | "DELETE") => {
    setMenyimpan(true);
    setPesan(null);
    try {
      const res = method === "PUT"
        ? await fetch(endpoint, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ anggota_id: anggotaId }),
          })
        : await fetch(`${endpoint}?anggota_id=${anggotaId}`, { method });
      const json = await res.json();
      if (!res.ok) {
        setPesan({ teks: json.error ?? "Gagal memperbarui daftar petugas.", gagal: true });
        return;
      }
      setPesan({ teks: method === "PUT" ? `${nama} ditambahkan.` : `${nama} dihapus dari daftar petugas.` });
      setMuatUlang((prev) => prev + 1);
      if (method === "PUT") {
        setMencari(false);
        setQuery("");
        setHasil(null);
      }
    } catch {
      setPesan({ teks: "Tidak dapat terhubung ke server.", gagal: true });
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Card className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
      <section aria-labelledby="petugas-kegiatan-title" aria-busy={menyimpan} className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h3 id="petugas-kegiatan-title" className="flex items-center gap-2 text-body-lg font-semibold text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined size-5 shrink-0 overflow-hidden text-[20px] text-secondary">groups</span>
            Daftar Petugas
            {petugas && <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-sm tabular-nums text-on-secondary-container">{petugas.length}</span>}
          </h3>
          {isAdmin && (
            <button
              type="button"
              aria-expanded={mencari}
              aria-controls={mencari ? "cari-petugas-kegiatan" : undefined}
              disabled={menyimpan}
              onClick={() => {
                setMencari(!mencari);
                setQuery("");
                setHasil(null);
                setPesan(null);
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-primary/30 px-3 text-label-md text-primary hover:bg-primary-fixed/30 disabled:opacity-50"
            >
              <span aria-hidden="true" className="material-symbols-outlined size-5 shrink-0 overflow-hidden text-[18px]">{mencari ? "close" : "person_add"}</span>
              {mencari ? "Tutup pencarian" : "Tambah Petugas"}
            </button>
          )}
        </div>

        {mencari && (
          <div id="cari-petugas-kegiatan" className="mt-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
            <label htmlFor="cari-anggota-petugas" className="mb-1.5 block text-label-sm font-semibold text-on-surface">Cari anggota DWP yang sudah hadir</label>
            <input
              id="cari-anggota-petugas"
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nama atau NIP (minimal 2 karakter)"
              className="min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {kataKunci.length >= 2 && (
              hasilTerkini?.data.length ? (
                <ul className="mt-2 max-h-56 divide-y divide-outline-variant overflow-y-auto rounded-lg border border-outline-variant bg-surface">
                  {hasilTerkini.data.map((anggota) => {
                    const terdaftar = petugas?.some((item) => item.anggota_id === anggota.anggota_id);
                    return (
                      <li key={anggota.anggota_id}>
                        <button
                          type="button"
                          aria-label={terdaftar ? `${anggota.nama} sudah terdaftar` : `Tambahkan ${anggota.nama} sebagai petugas`}
                          disabled={menyimpan || terdaftar}
                          onClick={() => ubahPetugas(anggota.anggota_id, anggota.nama, "PUT")}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:enabled:bg-primary-fixed/30 disabled:opacity-60"
                        >
                          <div className="min-w-0">
                            <p className="wrap-anywhere text-body-sm font-semibold text-on-surface">{anggota.nama}</p>
                            <p className="wrap-anywhere text-label-sm text-on-surface-variant">{anggota.nip} · {anggota.unit_kerja}</p>
                          </div>
                          <span className="shrink-0 text-label-sm text-primary">{terdaftar ? "Terdaftar" : "Tambah"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p role="status" className="pt-2 text-body-sm text-on-surface-variant">
                  {hasilTerkini ? (hasilTerkini.gagal ? "Pencarian gagal. Silakan coba lagi." : "Tidak ada anggota tercatat hadir yang cocok.") : "Mencari anggota…"}
                </p>
              )
            )}
          </div>
        )}

        {pesan && (
          <p role={pesan.gagal ? "alert" : "status"} className={`mt-3 text-body-sm ${pesan.gagal ? "text-error" : "text-tertiary"}`}>
            {pesan.teks}
          </p>
        )}
        {muatGagal && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-error">
            <p role="alert">Daftar petugas gagal dimuat.</p>
            <button type="button" onClick={() => setMuatUlang((prev) => prev + 1)} className="font-semibold underline">Coba lagi</button>
          </div>
        )}
        {petugas?.length ? (
          <ul className="mt-3 max-h-60 divide-y divide-outline-variant overflow-y-auto rounded-xl border border-outline-variant">
            {petugas.map((item) => (
              <li key={item.anggota_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="wrap-anywhere text-body-sm font-semibold text-on-surface">{item.nama}</p>
                  <p className="wrap-anywhere text-label-sm text-on-surface-variant">{[item.unit_kerja, item.nip].filter(Boolean).join(" · ")}</p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    title="Hapus petugas"
                    aria-label={`Hapus ${item.nama} dari daftar petugas`}
                    disabled={menyimpan}
                    onClick={() => ubahPetugas(item.anggota_id, item.nama, "DELETE")}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-error hover:bg-error-container disabled:opacity-50"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined size-5 overflow-hidden text-[18px]">delete</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : !muatGagal && (
          <p className="mt-3 flex flex-1 items-center rounded-xl bg-surface-container-low px-3 py-3 text-body-sm text-on-surface-variant">
            {petugas ? "Belum ada petugas untuk kegiatan ini." : "Memuat daftar petugas…"}
          </p>
        )}
      </section>
    </Card>
  );
}
