import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

// GET /api/doorprize — daftar kegiatan yang punya hadiah
export async function GET(_req: NextRequest) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         k.id, k.judul, k.tanggal, k.lokasi, k.kategori, k.status, k.event_code,
         (SELECT COUNT(*) FROM doorprize_hadiah h WHERE h.kegiatan_id = k.id) AS total_hadiah,
         (SELECT COUNT(*) FROM doorprize_winners w WHERE w.kegiatan_id = k.id) AS total_winners
       FROM kegiatan k
       WHERE EXISTS (SELECT 1 FROM doorprize_hadiah h WHERE h.kegiatan_id = k.id)
       ORDER BY k.tanggal DESC`
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data doorprize" }, { status: 500 });
  }
}
