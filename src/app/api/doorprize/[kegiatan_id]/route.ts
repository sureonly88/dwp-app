import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// GET /api/doorprize/[kegiatan_id] — kegiatan + setup + flat winners list
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { kegiatan_id } = await params;

    const [kegRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, judul, tanggal, lokasi, kategori, status, event_code FROM kegiatan WHERE id = ?`,
      [kegiatan_id]
    );
    if (kegRows.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }

    const [setupRows] = await pool.execute<RowDataPacket[]>(
      `SELECT jumlah_hadiah FROM doorprize_setup WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );

    const [winners] = await pool.execute<RowDataPacket[]>(
      `SELECT w.id, h.urutan, a.nama, a.nip, a.jabatan, a.unit_kerja, w.waktu, w.anggota_id
       FROM doorprize_winners w
       JOIN doorprize_hadiah h ON h.id = w.hadiah_id
       JOIN anggota a ON a.id = w.anggota_id
       WHERE w.kegiatan_id = ?
       ORDER BY h.urutan ASC`,
      [kegiatan_id]
    );

    // Jumlah anggota yang hadir di kegiatan ini
    const [hadirRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS hadir_count FROM presensi WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );

    // Jumlah peserta yang masih memenuhi syarat untuk diundi (hadir, aktif, belum menang doorprize kegiatan ini)
    const [eligibleRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS eligible_count
       FROM anggota a
       INNER JOIN presensi pr ON pr.anggota_id = a.id AND pr.kegiatan_id = ?
       WHERE a.status = 'Aktif'
         AND a.id NOT IN (SELECT anggota_id FROM doorprize_winners WHERE kegiatan_id = ?)`,
      [kegiatan_id, kegiatan_id]
    );

    return NextResponse.json({
      kegiatan: kegRows[0],
      setup: setupRows[0] ?? null,
      winners,
      hadir_count: Number(hadirRows[0].hadir_count),
      eligible_count: Number(eligibleRows[0].eligible_count),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

// PUT /api/doorprize/[kegiatan_id] — upsert setup (jumlah_hadiah)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { kegiatan_id } = await params;
    const body = await req.json();
    const jumlah = Number(body.jumlah_hadiah);
    if (!Number.isInteger(jumlah) || jumlah < 1) {
      return NextResponse.json({ error: "Jumlah hadiah tidak valid" }, { status: 400 });
    }
    await pool.execute<ResultSetHeader>(
      `INSERT INTO doorprize_setup (kegiatan_id, jumlah_hadiah)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE jumlah_hadiah = VALUES(jumlah_hadiah)`,
      [kegiatan_id, jumlah]
    );
    return NextResponse.json({ jumlah_hadiah: jumlah });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan setup" }, { status: 500 });
  }
}

// DELETE /api/doorprize/[kegiatan_id] — reset semua data doorprize kegiatan ini
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { kegiatan_id } = await params;
    await pool.execute(`DELETE FROM doorprize_winners WHERE kegiatan_id = ?`, [kegiatan_id]);
    await pool.execute(`DELETE FROM doorprize_hadiah WHERE kegiatan_id = ?`, [kegiatan_id]);
    await pool.execute(`DELETE FROM doorprize_setup WHERE kegiatan_id = ?`, [kegiatan_id]);
    return NextResponse.json({ message: "Data doorprize direset" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mereset data" }, { status: 500 });
  }
}
