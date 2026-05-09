import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface TamuRow extends RowDataPacket {
  id: number;
  kegiatan_id: number;
  nama: string;
  instansi: string | null;
  keterangan: string | null;
  foto: string | null;
  waktu_hadir: string;
}

// GET /api/kegiatan/[id]/presensi/tamu
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [rows] = await pool.execute<TamuRow[]>(
      `SELECT id, kegiatan_id, nama, instansi, keterangan, foto, waktu_hadir
       FROM presensi_tamu
       WHERE kegiatan_id = ?
       ORDER BY waktu_hadir DESC`,
      [id]
    );
    return NextResponse.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil daftar tamu" }, { status: 500 });
  }
}

// POST /api/kegiatan/[id]/presensi/tamu  body: { nama, instansi?, keterangan? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const nama = String(body.nama ?? "").trim();
    if (!nama) {
      return NextResponse.json({ error: "Nama tamu wajib diisi" }, { status: 400 });
    }
    const instansi = body.instansi ? String(body.instansi).trim() || null : null;
    const keterangan = body.keterangan ? String(body.keterangan).trim() || null : null;
    const foto: string | null = typeof body.foto === "string" && body.foto.startsWith("data:image/") ? body.foto : null;
    if (foto && foto.length > 900_000) {
      return NextResponse.json({ error: "Ukuran foto terlalu besar (maks ~700KB)" }, { status: 413 });
    }

    // Validate kegiatan exists & not Dibatalkan
    const [keg] = await pool.execute<RowDataPacket[]>(
      "SELECT id, status FROM kegiatan WHERE id = ? LIMIT 1",
      [id]
    );
    if (keg.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }
    if ((keg[0] as { status: string }).status === "Dibatalkan") {
      return NextResponse.json({ error: "Kegiatan sudah dibatalkan" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO presensi_tamu (kegiatan_id, nama, instansi, keterangan, foto) VALUES (?, ?, ?, ?, ?)`,
      [id, nama, instansi, keterangan, foto]
    );
    return NextResponse.json(
      { id: result.insertId, nama, message: `Kehadiran tamu ${nama} tercatat` },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mencatat kehadiran tamu" }, { status: 500 });
  }
}

// DELETE /api/kegiatan/[id]/presensi/tamu?tamu_id=X
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const tamuId = searchParams.get("tamu_id");

    if (!tamuId) {
      return NextResponse.json({ error: "tamu_id wajib" }, { status: 400 });
    }
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM presensi_tamu WHERE id = ? AND kegiatan_id = ?",
      [tamuId, id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Data tamu tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Data tamu dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus data tamu" }, { status: 500 });
  }
}
