import pool from "./db";
import type { RowDataPacket } from "mysql2";
export { STATUS_KEANGGOTAAN_OPTIONS, type StatusKeanggotaan } from "./anggota-options";

let ensureTanggalPensiunPromise: Promise<void> | null = null;
let ensureStatusKeanggotaanPromise: Promise<void> | null = null;
let ensureTanggalLahirPromise: Promise<void> | null = null;

export interface AnggotaFilters {
  search?: string;
  status?: string;
  unit?: string;
  jenis?: string;
}

export function buildEffectiveStatusSql(alias?: string) {
  const prefix = alias ? `${alias}.` : "";
  return `CASE WHEN ${prefix}status = 'Non-Aktif' AND ${prefix}tanggal_keluar IS NOT NULL AND ${prefix}tanggal_keluar > CURDATE() THEN 'Aktif' ELSE ${prefix}status END`;
}

export function buildCurrentActiveCondition(alias?: string) {
  return `${buildEffectiveStatusSql(alias)} = 'Aktif'`;
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
  const effectiveStatusSql = buildEffectiveStatusSql();

  if (filters.search) {
    conditions.push("(nama LIKE ? OR nip LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.status) {
    conditions.push(`${effectiveStatusSql} = ?`);
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

export async function ensureAnggotaTanggalLahirColumn() {
  if (!ensureTanggalLahirPromise) {
    ensureTanggalLahirPromise = (async () => {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SHOW COLUMNS FROM anggota LIKE 'tanggal_lahir'`
      );

      if (!rows.length) {
        await pool.execute(
          `ALTER TABLE anggota ADD COLUMN tanggal_lahir DATE NULL AFTER alamat`
        );
      }
    })().catch((error) => {
      ensureTanggalLahirPromise = null;
      throw error;
    });
  }

  await ensureTanggalLahirPromise;
}

export async function ensureAnggotaStatusKeanggotaanColumn() {
  if (!ensureStatusKeanggotaanPromise) {
    ensureStatusKeanggotaanPromise = (async () => {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SHOW COLUMNS FROM anggota LIKE 'status_keanggotaan'`
      );

      if (!rows.length) {
        await pool.execute(
          `ALTER TABLE anggota ADD COLUMN status_keanggotaan ENUM('Istri Karyawan','Karyawati','Pengurus') NOT NULL DEFAULT 'Istri Karyawan' AFTER status`
        );
      } else {
        const columnType = String((rows[0] as RowDataPacket & { Type?: string }).Type ?? "").toLowerCase();
        if (!columnType.includes("'pengurus'")) {
          await pool.execute(
            `ALTER TABLE anggota MODIFY COLUMN status_keanggotaan ENUM('Istri Karyawan','Karyawati','Pengurus') NOT NULL DEFAULT 'Istri Karyawan'`
          );
        }
      }
    })().catch((error) => {
      ensureStatusKeanggotaanPromise = null;
      throw error;
    });
  }

  await ensureStatusKeanggotaanPromise;
}

export async function ensureAnggotaSchema() {
  await ensureAnggotaTanggalLahirColumn();
  await ensureAnggotaTanggalPensiunColumn();
  await ensureAnggotaStatusKeanggotaanColumn();
}