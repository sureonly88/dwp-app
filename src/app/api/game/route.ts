import { NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { ensureGameSetupSchema } from "@/lib/game";

// GET /api/game — daftar kegiatan yang punya setup game
export async function GET() {
  try {
    await ensureGameSetupSchema();

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         k.id, k.judul, k.tanggal, k.lokasi, k.kategori, k.status, k.event_code,
         gs.id AS game_setup_id,
         gs.nama_game,
         COUNT(DISTINCT h.id) AS total_hadiah,
         COUNT(DISTINCT w.id) AS total_winners
       FROM game_setup gs
       JOIN kegiatan k              ON k.id = gs.kegiatan_id
       LEFT JOIN game_hadiah h      ON h.game_setup_id = gs.id
       LEFT JOIN game_winners w     ON w.game_setup_id = gs.id
       GROUP BY gs.id
       ORDER BY k.tanggal DESC, gs.id ASC`
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data game" }, { status: 500 });
  }
}
