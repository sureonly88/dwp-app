import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";

let ensureArisanSetupSchemaPromise: Promise<void> | null = null;

export async function ensureArisanSetupSchema() {
  if (!ensureArisanSetupSchemaPromise) {
    ensureArisanSetupSchemaPromise = (async () => {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SHOW COLUMNS FROM arisan_setup LIKE 'jumlah_per_undi'`
      );

      if (!rows.length) {
        await pool.execute(
          `ALTER TABLE arisan_setup ADD COLUMN jumlah_per_undi INT UNSIGNED NOT NULL DEFAULT 10 AFTER jumlah_pemenang`
        );
      }
    })().catch((error) => {
      ensureArisanSetupSchemaPromise = null;
      throw error;
    });
  }

  await ensureArisanSetupSchemaPromise;
}
