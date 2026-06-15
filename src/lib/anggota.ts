import pool from "./db";
import type { RowDataPacket } from "mysql2";

let ensureTanggalPensiunPromise: Promise<void> | null = null;

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