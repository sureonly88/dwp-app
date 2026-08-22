import pool from "./db";
import type { RowDataPacket } from "mysql2";

export interface UnitKerjaOption extends RowDataPacket {
  id: number;
  nama: string;
  aktif: number;
}

export function normalizeUnitKerja(value: unknown) {
  if (typeof value !== "string") return { value: null, error: undefined };

  const unitKerja = value.trim();
  if (!unitKerja) return { value: null, error: undefined };

  if (unitKerja.length > 100) {
    return { value: null, error: "Unit kerja maksimal 100 karakter" };
  }

  return { value: unitKerja, error: undefined };
}

export async function getUnitKerjaOptions() {
  const [rows] = await pool.execute<UnitKerjaOption[]>(
    "SELECT id, nama, aktif FROM unit_kerja ORDER BY nama ASC"
  );

  return rows;
}

export async function isUnitKerjaTerdaftar(nama: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM unit_kerja WHERE nama = ? LIMIT 1",
    [nama]
  );

  return rows.length > 0;
}
