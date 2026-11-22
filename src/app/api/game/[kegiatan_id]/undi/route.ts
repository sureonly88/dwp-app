import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { requireAdmin } from "@/lib/admin-auth";
import { ensureAnggotaSchema } from "@/lib/anggota";
import { ensureGameSetupSchema, GAME_ELIGIBLE_MEMBERS_SQL } from "@/lib/game";

interface GameCandidateRow extends RowDataPacket {
  peserta_tipe: "anggota";
  anggota_id: number;
  tamu_id: null;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  unit_kerja: string | null;
  instansi: null;
  foto: string | null;
}

function pickRandomBatch<T>(items: T[], count: number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// POST /api/game/[kegiatan_id]/undi — auto-undian sesuai setup peserta terpilih per putaran
export async function POST(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  let conn: PoolConnection | undefined;
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { kegiatan_id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsedGameSetupId = Number(body.game_setup_id);
    const gameSetupId = Number.isInteger(parsedGameSetupId) && parsedGameSetupId > 0 ? parsedGameSetupId : null;
    if (!gameSetupId) {
      return NextResponse.json({ error: "Setup game wajib dipilih" }, { status: 400 });
    }

    await ensureAnggotaSchema();
    await ensureGameSetupSchema();

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Check setup
    const [setupRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id, jumlah_hadiah, jumlah_per_undi
       FROM game_setup
       WHERE id = ? AND kegiatan_id = ?`,
      [gameSetupId, kegiatan_id]
    );
    if (setupRows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ error: "Setup game belum dikonfigurasi" }, { status: 400 });
    }
    const jumlahHadiah: number = setupRows[0].jumlah_hadiah;
    const jumlahPerUndi = Math.max(1, Number(setupRows[0].jumlah_per_undi ?? 10));

    // Count current winners
    const [cntRows] = await conn.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt
       FROM game_winners
       WHERE kegiatan_id = ?
         AND game_setup_id = ?`,
      [kegiatan_id, gameSetupId]
    );
    const currentCount: number = cntRows[0].cnt;

    if (currentCount >= jumlahHadiah) {
      await conn.rollback();
      return NextResponse.json({ error: "Pengundian sudah habis. Semua kuota peserta terpilih sudah terpenuhi." }, { status: 400 });
    }

    const [candidateRows] = await conn.execute<GameCandidateRow[]>(
      `SELECT 'anggota' AS peserta_tipe,
              a.id AS anggota_id,
              NULL AS tamu_id,
              a.nama,
              a.nip,
              a.jabatan,
              a.unit_kerja,
              NULL AS instansi,
              CASE
                WHEN pr.foto IS NOT NULL AND TRIM(pr.foto) <> '' THEN pr.foto
                ELSE NULL
              END AS foto
       ${GAME_ELIGIBLE_MEMBERS_SQL}`,
      [kegiatan_id, kegiatan_id, gameSetupId]
    );

    if (candidateRows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ error: "Tidak ada anggota hadir yang memenuhi syarat dan masih bisa diundi." }, { status: 400 });
    }

    const remainingSlots = jumlahHadiah - currentCount;
    const drawCount = Math.min(jumlahPerUndi, remainingSlots, candidateRows.length);
    const pickedWinners = pickRandomBatch(candidateRows, drawCount);

    const createdWinners = [];
    for (const [index, winner] of pickedWinners.entries()) {
      const urutan = currentCount + index + 1;

      const [hadiahRes] = await conn.execute<ResultSetHeader>(
        `INSERT INTO game_hadiah (kegiatan_id, game_setup_id, nama_hadiah, urutan) VALUES (?, ?, ?, ?)`,
        [kegiatan_id, gameSetupId, `Peserta Terpilih ke-${urutan}`, urutan]
      );
      const hadiahId = hadiahRes.insertId;

      const [winnerRes] = await conn.execute<ResultSetHeader>(
        `INSERT INTO game_winners (kegiatan_id, game_setup_id, hadiah_id, peserta_tipe, anggota_id, tamu_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [kegiatan_id, gameSetupId, hadiahId, winner.peserta_tipe, winner.anggota_id, winner.tamu_id]
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
        foto: winner.foto,
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
