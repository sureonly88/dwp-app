import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

// GET /api/arisan/winners?tahun=
// Returns all arisan winners across all events, optionally filtered by year
export async function GET(req: NextRequest) {
  try {
    const tahun = new URL(req.url).searchParams.get("tahun");

    const params: (string | number)[] = [];
    let whereClause = "";
    if (tahun && !isNaN(Number(tahun))) {
      whereClause = "WHERE YEAR(k.tanggal) = ?";
      params.push(Number(tahun));
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT aw.id, aw.urutan, aw.waktu,
              a.id AS anggota_id, a.nama, a.nip, a.jabatan, a.unit_kerja,
              k.id AS kegiatan_id, k.judul AS kegiatan_judul,
              k.tanggal AS kegiatan_tanggal, k.lokasi,
              s.nominal_per_orang
       FROM arisan_winners aw
       JOIN anggota a ON a.id = aw.anggota_id
       JOIN kegiatan k ON k.id = aw.kegiatan_id
       LEFT JOIN arisan_setup s ON s.kegiatan_id = k.id
       ${whereClause}
       ORDER BY k.tanggal DESC, aw.urutan ASC`,
      params,
    );

    const [yearRows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT YEAR(k.tanggal) AS tahun
       FROM arisan_winners aw
       JOIN kegiatan k ON k.id = aw.kegiatan_id
       ORDER BY tahun DESC`,
    );

    return NextResponse.json({
      data: rows,
      years: yearRows.map((r) => Number(r.tahun)),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}
