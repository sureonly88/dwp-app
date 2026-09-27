import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { ensureAnggotaSchema } from "@/lib/anggota";

export interface ArisanBelumMenerimaRow extends RowDataPacket {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status_keanggotaan: string;
  no_hp: string | null;
  email: string | null;
}

export interface ArisanBelumMenerimaReport {
  rows: ArisanBelumMenerimaRow[];
  summary: {
    tahun: number;
    bulan: number;
    awal: string;
    akhir: string;
    label: string;
    total_belum_menerima: number;
    total_anggota_eligible: number;
    total_sudah_menerima: number;
  };
}

function normalizeYear(value: number) {
  if (!Number.isFinite(value)) return new Date().getFullYear();
  return Math.min(9999, Math.max(1900, Math.trunc(value)));
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildArisanEligibleCondition(alias: string) {
  return `${alias}.status IN ('Aktif', 'Non-Aktif')
       AND ${alias}.status_keanggotaan IN ('Istri Karyawan', 'Karyawati')`;
}

export function parseArisanBelumMenerimaPeriod(searchParams: URLSearchParams) {
  const now = new Date();
  const tahun = normalizeYear(Number(searchParams.get("tahun") ?? now.getFullYear()));

  return {
    tahun,
    bulan: 12,
    awal: formatDate(tahun, 1, 1),
    akhir: formatDate(tahun, 12, 31),
    label: `Januari - Desember ${tahun}`,
  };
}

export async function getArisanBelumMenerimaReport(
  searchParams: URLSearchParams,
): Promise<ArisanBelumMenerimaReport> {
  await ensureAnggotaSchema();

  const periode = parseArisanBelumMenerimaPeriod(searchParams);
  const winnerSubquery = `
    SELECT DISTINCT aw.anggota_id
    FROM arisan_winners aw
    INNER JOIN kegiatan k ON k.id = aw.kegiatan_id
    WHERE k.tanggal BETWEEN ? AND ?
  `;

  const [rows] = await pool.execute<ArisanBelumMenerimaRow[]>(
    `SELECT a.id, a.nama, a.nip, a.jabatan, a.unit_kerja, a.status_keanggotaan, a.no_hp, a.email
     FROM anggota a
     LEFT JOIN (${winnerSubquery}) penerima ON penerima.anggota_id = a.id
     WHERE ${buildArisanEligibleCondition("a")}
       AND penerima.anggota_id IS NULL
     ORDER BY a.unit_kerja ASC, a.nama ASC`,
    [periode.awal, periode.akhir],
  );

  const [eligibleRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM anggota a
     WHERE ${buildArisanEligibleCondition("a")}`,
  );

  const [winnerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT aw.anggota_id) AS total
     FROM arisan_winners aw
     INNER JOIN kegiatan k ON k.id = aw.kegiatan_id
     INNER JOIN anggota a ON a.id = aw.anggota_id
     WHERE k.tanggal BETWEEN ? AND ?
       AND ${buildArisanEligibleCondition("a")}`,
    [periode.awal, periode.akhir],
  );

  return {
    rows,
    summary: {
      ...periode,
      total_belum_menerima: rows.length,
      total_anggota_eligible: Number(eligibleRows[0]?.total ?? 0),
      total_sudah_menerima: Number(winnerRows[0]?.total ?? 0),
    },
  };
}
