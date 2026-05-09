import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

// GET /api/doorprize — daftar kegiatan yang punya hadiah
export async function GET(_req: NextRequest) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         k.id, k.judul, k.tanggal, k.lokasi, k.kategori, k.status, k.event_code,
         COUNT(DISTINCT h.id) AS total_hadiah,
         COUNT(DISTINCT w.id) AS total_winners
       FROM doorprize_hadiah h
       JOIN kegiatan k              ON k.id = h.kegiatan_id
       LEFT JOIN doorprize_winners w ON w.kegiatan_id = k.id
       GROUP BY k.id
       ORDER BY k.tanggal DESC`
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data doorprize" }, { status: 500 });
  }
}
