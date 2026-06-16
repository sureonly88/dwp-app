import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";

export type DoorprizePesertaTipe = "anggota" | "tamu";

interface DoorprizeCandidateRow extends RowDataPacket {
  peserta_tipe: DoorprizePesertaTipe;
  anggota_id: number | null;
  tamu_id: number | null;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  unit_kerja: string | null;
  instansi: string | null;
}

export interface DoorprizeCandidate {
  peserta_tipe: DoorprizePesertaTipe;
  anggota_id: number | null;
  tamu_id: number | null;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  unit_kerja: string | null;
  instansi: string | null;
}

export async function listHadirAnggotaDoorprizeNames(kegiatanId: number | string): Promise<string[]> {
  // Ambil nama anggota yang hadir
  const [anggotaRows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT a.nama
     FROM anggota a
     INNER JOIN presensi pr ON pr.anggota_id = a.id
     WHERE pr.kegiatan_id = ?
       AND COALESCE(NULLIF(TRIM(a.nama), ''), '') <> ''
     ORDER BY a.nama ASC`,
    [kegiatanId]
  );

  // Ambil nama tamu yang hadir — tamu juga masuk animasi roll doorprize
  const [tamuRows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT pt.nama
     FROM presensi_tamu pt
     WHERE pt.kegiatan_id = ?
       AND COALESCE(NULLIF(TRIM(pt.nama), ''), '') <> ''
     ORDER BY pt.nama ASC`,
    [kegiatanId]
  );

  const anggotaNames = anggotaRows
    .map((row) => String(row.nama ?? "").trim())
    .filter(Boolean);

  const tamuNames = tamuRows
    .map((row) => String(row.nama ?? "").trim())
    .filter(Boolean);

  return [...anggotaNames, ...tamuNames];
}

export async function listEligibleDoorprizeCandidates(kegiatanId: number | string): Promise<DoorprizeCandidate[]> {
  const [rows] = await pool.execute<DoorprizeCandidateRow[]>(
    `SELECT 'anggota' AS peserta_tipe,
            a.id AS anggota_id,
            NULL AS tamu_id,
            a.nama,
            a.nip,
            a.jabatan,
            a.unit_kerja,
            NULL AS instansi
     FROM anggota a
     INNER JOIN presensi pr ON pr.anggota_id = a.id AND pr.kegiatan_id = ?
     WHERE a.id NOT IN (
         SELECT anggota_id
         FROM doorprize_winners
         WHERE kegiatan_id = ?
           AND anggota_id IS NOT NULL
       )

     UNION ALL

     SELECT 'tamu' AS peserta_tipe,
            NULL AS anggota_id,
            pt.id AS tamu_id,
            pt.nama,
            NULL AS nip,
            'Tamu' AS jabatan,
            COALESCE(NULLIF(TRIM(pt.instansi), ''), 'Tamu Non-Anggota') AS unit_kerja,
            pt.instansi
     FROM presensi_tamu pt
     WHERE pt.kegiatan_id = ?
       AND pt.id NOT IN (
         SELECT tamu_id
         FROM doorprize_winners
         WHERE kegiatan_id = ?
           AND tamu_id IS NOT NULL
       )`,
    [kegiatanId, kegiatanId, kegiatanId, kegiatanId]
  );

  return rows.map((row) => ({
    peserta_tipe: row.peserta_tipe,
    anggota_id: row.anggota_id ? Number(row.anggota_id) : null,
    tamu_id: row.tamu_id ? Number(row.tamu_id) : null,
    nama: row.nama,
    nip: row.nip,
    jabatan: row.jabatan,
    unit_kerja: row.unit_kerja,
    instansi: row.instansi,
  }));
}

export async function pickRandomDoorprizeCandidate(kegiatanId: number | string): Promise<DoorprizeCandidate | null> {
  const candidates = await listEligibleDoorprizeCandidates(kegiatanId);
  if (candidates.length === 0) return null;

  const pickedIndex = Math.floor(Math.random() * candidates.length);
  return candidates[pickedIndex] ?? null;
}

export async function countDoorprizePresentParticipants(kegiatanId: number | string): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT (
        SELECT COUNT(DISTINCT pr.anggota_id)
        FROM presensi pr
        WHERE pr.kegiatan_id = ?
      ) + (
        SELECT COUNT(*)
        FROM presensi_tamu
        WHERE kegiatan_id = ?
      ) AS hadir_count`,
    [kegiatanId, kegiatanId]
  );

  return Number(rows[0]?.hadir_count ?? 0);
}