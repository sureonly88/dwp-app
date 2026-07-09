import { NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface UnitKerjaAnggotaRow extends RowDataPacket {
  nama: string;
}

// GET /api/anggota/unit-kerja
export async function GET() {
  try {
    const [rows] = await pool.execute<UnitKerjaAnggotaRow[]>(`
      SELECT DISTINCT TRIM(unit_kerja) AS nama
      FROM anggota
      WHERE unit_kerja IS NOT NULL
        AND TRIM(unit_kerja) <> ''
      ORDER BY nama ASC
    `);

    return NextResponse.json(rows.map((row, index) => ({
      id: index + 1,
      nama: row.nama,
    })));
  } catch (err) {
    console.error("GET /api/anggota/unit-kerja error:", err);
    return NextResponse.json({ error: "Gagal mengambil data unit kerja anggota" }, { status: 500 });
  }
}