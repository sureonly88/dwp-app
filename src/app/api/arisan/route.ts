import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

// GET /api/arisan — list kegiatan yang punya setup arisan, beserta progres pemenang
export async function GET(_req: NextRequest) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         k.id, k.judul, k.tanggal, k.lokasi, k.kategori, k.status, k.event_code,
         s.nominal_per_orang, s.jumlah_pemenang,
         (SELECT COUNT(*) FROM arisan_winners w WHERE w.kegiatan_id = k.id) AS total_winners
       FROM arisan_setup s
       JOIN kegiatan k ON k.id = s.kegiatan_id
       ORDER BY k.tanggal DESC`
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data arisan" }, { status: 500 });
  }
}
