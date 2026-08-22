import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { getUnitKerjaOptions } from "@/lib/unit-kerja";

// GET /api/presensi/[code]/unit-kerja -> daftar unit kerja untuk halaman presensi publik
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const [keg] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM kegiatan WHERE event_code = ? LIMIT 1",
      [code]
    );
    if (keg.length === 0) {
      return NextResponse.json({ error: "Kode kegiatan tidak valid" }, { status: 404 });
    }

    const rows = await getUnitKerjaOptions();
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data unit kerja" }, { status: 500 });
  }
}
