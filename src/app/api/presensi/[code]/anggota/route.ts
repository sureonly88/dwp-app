import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { buildEffectiveStatusSql } from "@/lib/anggota";

// GET /api/presensi/[code]/anggota?search=
// Public-safe search used by the check-in page. Returns minimal anggota info.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") ?? "").trim();

    // Validate event code first
    const [keg] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM kegiatan WHERE event_code = ? LIMIT 1",
      [code]
    );
    if (keg.length === 0) {
      return NextResponse.json({ error: "Kode kegiatan tidak valid" }, { status: 404 });
    }
    if (!search || search.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const kegiatanId = (keg[0] as { id: number }).id;
    const like = `%${search}%`;
    const effectiveStatusSql = buildEffectiveStatusSql("a");

    // Return anggota with attendance flag for this kegiatan
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.id, a.nama, a.nip, a.jabatan, a.unit_kerja, a.no_hp,
              EXISTS(SELECT 1 FROM presensi p WHERE p.kegiatan_id = ? AND p.anggota_id = a.id) AS sudah_hadir
       FROM anggota a
       WHERE ${effectiveStatusSql} <> 'Non-Aktif' AND (a.nama LIKE ? OR a.nip LIKE ?)
       ORDER BY a.nama ASC
       LIMIT 10`,
      [kegiatanId, like, like]
    );

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mencari anggota" }, { status: 500 });
  }
}
