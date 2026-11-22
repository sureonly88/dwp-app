import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";
import { catatPresensiTamu } from "@/lib/presensi-tamu";

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

// POST /api/kegiatan/[id]/presensi/tamu  body: { nama, instansi?, keterangan?, foto? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(req);
  if (response) return response;
  const { id } = await params;
  return catatPresensiTamu(req, { id });
}

// DELETE /api/kegiatan/[id]/presensi/tamu?tamu_id=X
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
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
