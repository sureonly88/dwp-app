import type { ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import pool from "@/lib/db";

// Mengacu pada baris presensi beralias pr di kueri pengundian.
export const PRESENSI_NON_PETUGAS_SQL = `NOT EXISTS (
  SELECT 1
  FROM kegiatan_petugas kp
  WHERE kp.kegiatan_id = pr.kegiatan_id AND kp.anggota_id = pr.anggota_id
)`;

export interface PetugasKegiatan {
  anggota_id: number;
  nama: string;
  nip: string;
  unit_kerja: string;
}

export async function simpanPetugasKegiatan(
  kegiatanId: string | number,
  anggotaId: number,
  db: PoolConnection | typeof pool = pool,
) {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO kegiatan_petugas (kegiatan_id, anggota_id)
     SELECT p.kegiatan_id, p.anggota_id
     FROM presensi p
     WHERE p.kegiatan_id = ? AND p.anggota_id = ?
     ON DUPLICATE KEY UPDATE anggota_id = kegiatan_petugas.anggota_id`,
    [kegiatanId, anggotaId],
  );
  return result.affectedRows > 0;
}
