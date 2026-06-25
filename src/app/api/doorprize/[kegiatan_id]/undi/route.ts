import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { requireAdmin } from "@/lib/admin-auth";

interface DoorprizeCandidateRow extends RowDataPacket {
  peserta_tipe: "anggota" | "tamu";
  anggota_id: number | null;
  tamu_id: number | null;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  unit_kerja: string | null;
  instansi: string | null;
}

function pickRandomBatch<T>(items: T[], count: number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// POST /api/doorprize/[kegiatan_id]/undi — auto-undian maksimal 10 pemenang doorprize per putaran
export async function POST(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  let conn: PoolConnection | undefined;
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { kegiatan_id } = await params;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Check setup
    const [setupRows] = await conn.execute<RowDataPacket[]>(
      `SELECT jumlah_hadiah FROM doorprize_setup WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );
    if (setupRows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ error: "Setup doorprize belum dikonfigurasi" }, { status: 400 });
    }
    const jumlahHadiah: number = setupRows[0].jumlah_hadiah;

    // Count current winners
    const [cntRows] = await conn.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM doorprize_winners WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );
    const currentCount: number = cntRows[0].cnt;

    if (currentCount >= jumlahHadiah) {
      await conn.rollback();
      return NextResponse.json({ error: "Semua hadiah sudah terisi" }, { status: 400 });
    }

    const [candidateRows] = await conn.execute<DoorprizeCandidateRow[]>(
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
      [kegiatan_id, kegiatan_id, kegiatan_id, kegiatan_id]
    );

    if (candidateRows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ error: "Tidak ada peserta yang hadir dan belum menang doorprize" }, { status: 400 });
    }

    const remainingSlots = jumlahHadiah - currentCount;
    const drawCount = Math.min(10, remainingSlots, candidateRows.length);
    const pickedWinners = pickRandomBatch(candidateRows, drawCount);

    const createdWinners = [];
    for (const [index, winner] of pickedWinners.entries()) {
      const urutan = currentCount + index + 1;

      const [hadiahRes] = await conn.execute<ResultSetHeader>(
        `INSERT INTO doorprize_hadiah (kegiatan_id, nama_hadiah, urutan) VALUES (?, ?, ?)`,
        [kegiatan_id, `Hadiah ke-${urutan}`, urutan]
      );
      const hadiahId = hadiahRes.insertId;

      const [winnerRes] = await conn.execute<ResultSetHeader>(
        `INSERT INTO doorprize_winners (kegiatan_id, hadiah_id, peserta_tipe, anggota_id, tamu_id) VALUES (?, ?, ?, ?, ?)`,
        [kegiatan_id, hadiahId, winner.peserta_tipe, winner.anggota_id, winner.tamu_id]
      );

      createdWinners.push({
        id: winnerRes.insertId,
        urutan,
        peserta_tipe: winner.peserta_tipe,
        anggota_id: winner.anggota_id,
        tamu_id: winner.tamu_id,
        nama: winner.nama,
        nip: winner.nip,
        jabatan: winner.jabatan,
        unit_kerja: winner.unit_kerja,
        instansi: winner.instansi,
      });
    }

    await conn.commit();

    return NextResponse.json({
      winners: createdWinners,
      draw_count: createdWinners.length,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    return NextResponse.json({ error: "Gagal mengundi" }, { status: 500 });
  } finally {
    conn?.release();
  }
}
