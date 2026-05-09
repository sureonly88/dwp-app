import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

// POST /api/doorprize/[kegiatan_id]/hadiah — tambah hadiah baru
export async function POST(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { kegiatan_id } = await params;
    const body = await req.json();
    const nama = String(body.nama_hadiah ?? "").trim();
    if (!nama) {
      return NextResponse.json({ error: "Nama hadiah wajib diisi" }, { status: 400 });
    }

    const [kegRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM kegiatan WHERE id = ?`,
      [kegiatan_id]
    );
    if (kegRows.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }

    const [maxRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(MAX(urutan), 0) AS max_urutan FROM doorprize_hadiah WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );
    const urutan = Number(maxRows[0].max_urutan) + 1;

    const [ins] = await pool.execute<ResultSetHeader>(
      `INSERT INTO doorprize_hadiah (kegiatan_id, nama_hadiah, urutan) VALUES (?, ?, ?)`,
      [kegiatan_id, nama, urutan]
    );
    return NextResponse.json({ id: ins.insertId, urutan, message: "Hadiah ditambahkan" }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menambah hadiah" }, { status: 500 });
  }
}
