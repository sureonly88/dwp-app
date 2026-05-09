import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { computeKegiatanStatus } from "@/lib/kegiatanUtils";

// GET /api/kegiatan/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT k.*, (SELECT COUNT(*) FROM presensi p WHERE p.kegiatan_id = k.id) AS hadir_count,
              (SELECT COUNT(*) FROM presensi_tamu pt WHERE pt.kegiatan_id = k.id) AS tamu_count
       FROM kegiatan k WHERE k.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }
    const row = rows[0];
    return NextResponse.json({
      ...row,
      status: computeKegiatanStatus(row.tanggal, row.waktu_mulai, row.waktu_selesai, row.status),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

// PUT /api/kegiatan/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      judul,
      deskripsi,
      tanggal,
      waktu_mulai,
      waktu_selesai,
      lokasi,
      kategori,
      status,
      target_peserta,
    } = body;

    if (!judul || !tanggal) {
      return NextResponse.json({ error: "Judul dan tanggal wajib diisi" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE kegiatan SET
        judul=?, deskripsi=?, tanggal=?, waktu_mulai=?, waktu_selesai=?,
        lokasi=?, kategori=?, status=?, target_peserta=?
       WHERE id=?`,
      [
        judul,
        deskripsi ?? null,
        tanggal,
        waktu_mulai || null,
        waktu_selesai || null,
        lokasi ?? null,
        kategori ?? "Rapat",
        computeKegiatanStatus(tanggal, waktu_mulai || null, waktu_selesai || null, status ?? "Mendatang"),
        target_peserta ?? null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Kegiatan berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal memperbarui kegiatan" }, { status: 500 });
  }
}

// DELETE /api/kegiatan/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM kegiatan WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Kegiatan berhasil dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus kegiatan" }, { status: 500 });
  }
}
