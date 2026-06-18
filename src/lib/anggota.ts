import pool from "./db";
import type { RowDataPacket } from "mysql2";

let ensureTanggalPensiunPromise: Promise<void> | null = null;

export interface AnggotaFilters {
  search?: string;
  status?: string;
  unit?: string;
  jenis?: string;
}

function applyJenisFilter(jenis: string, conditions: string[]) {
  const normalizedJenis = jenis.trim().toLowerCase();

  if (normalizedJenis === "pengurus") {
    conditions.push("LOWER(TRIM(COALESCE(jabatan, ''))) <> 'anggota'");
  } else if (normalizedJenis === "anggota") {
    conditions.push("LOWER(TRIM(COALESCE(jabatan, ''))) = 'anggota'");
  }
}

export function buildAnggotaWhereClause(filters: AnggotaFilters) {
  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.search) {
    conditions.push("(nama LIKE ? OR nip LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }

  if (filters.unit) {
    conditions.push("unit_kerja = ?");
    params.push(filters.unit);
  }

  if (filters.jenis) {
    applyJenisFilter(filters.jenis, conditions);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export async function ensureAnggotaTanggalPensiunColumn() {
  if (!ensureTanggalPensiunPromise) {
    ensureTanggalPensiunPromise = (async () => {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SHOW COLUMNS FROM anggota LIKE 'tanggal_pensiun'`
      );

      if (!rows.length) {
        await pool.execute(
          `ALTER TABLE anggota ADD COLUMN tanggal_pensiun DATE NULL AFTER tanggal_keluar`
        );
      }
    })().catch((error) => {
      ensureTanggalPensiunPromise = null;
      throw error;
    });
  }

  await ensureTanggalPensiunPromise;
}