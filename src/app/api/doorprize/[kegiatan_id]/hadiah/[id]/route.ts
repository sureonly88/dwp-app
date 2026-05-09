import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

// PUT /api/doorprize/[kegiatan_id]/hadiah/[id] — rename
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ kegiatan_id: string; id: string }> }
) {
  try {
    const { kegiatan_id, id } = await params;
    const body = await req.json();
    const nama = String(body.nama_hadiah ?? "").trim();
    if (!nama) return NextResponse.json({ error: "Nama hadiah wajib diisi" }, { status: 400 });

    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE doorprize_hadiah SET nama_hadiah = ? WHERE id = ? AND kegiatan_id = ?`,
      [nama, id, kegiatan_id]
    );
    if (res.affectedRows === 0) {
      return NextResponse.json({ error: "Hadiah tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Hadiah diperbarui" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal memperbarui hadiah" }, { status: 500 });
  }
}

// DELETE /api/doorprize/[kegiatan_id]/hadiah/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ kegiatan_id: string; id: string }> }
) {
  try {
    const { kegiatan_id, id } = await params;
    const [res] = await pool.execute<ResultSetHeader>(
      `DELETE FROM doorprize_hadiah WHERE id = ? AND kegiatan_id = ?`,
      [id, kegiatan_id]
    );
    if (res.affectedRows === 0) {
      return NextResponse.json({ error: "Hadiah tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Hadiah dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus hadiah" }, { status: 500 });
  }
}

// POST /api/doorprize/[kegiatan_id]/hadiah/[id] — undi pemenang untuk hadiah ini
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ kegiatan_id: string; id: string }> }
) {
  try {
    const { kegiatan_id, id } = await params;

    // Pastikan hadiah ada dan belum punya pemenang
    const [hRows] = await pool.execute<RowDataPacket[]>(
      `SELECT h.id, h.nama_hadiah,
              (SELECT w.id FROM doorprize_winners w WHERE w.hadiah_id = h.id) AS winner_id
       FROM doorprize_hadiah h
       WHERE h.id = ? AND h.kegiatan_id = ?`,
      [id, kegiatan_id]
    );
    if (hRows.length === 0) {
      return NextResponse.json({ error: "Hadiah tidak ditemukan" }, { status: 404 });
    }
    if (hRows[0].winner_id) {
      return NextResponse.json({ error: "Hadiah ini sudah memiliki pemenang" }, { status: 400 });
    }

    // Pilih anggota Aktif yang belum menang doorprize lain di kegiatan ini
    const [pickRows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.id, a.nama, a.nip, a.jabatan, a.unit_kerja
       FROM anggota a
       WHERE a.status = 'Aktif'
         AND a.id NOT IN (
           SELECT anggota_id FROM doorprize_winners WHERE kegiatan_id = ?
         )
       ORDER BY RAND()
       LIMIT 1`,
      [kegiatan_id]
    );
    if (pickRows.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada anggota aktif yang tersedia" },
        { status: 400 }
      );
    }
    const picked = pickRows[0];

    const [ins] = await pool.execute<ResultSetHeader>(
      `INSERT INTO doorprize_winners (kegiatan_id, hadiah_id, anggota_id) VALUES (?, ?, ?)`,
      [kegiatan_id, id, picked.id]
    );

    return NextResponse.json({
      message: "Pemenang terpilih",
      winner: {
        id: ins.insertId,
        hadiah_id: Number(id),
        nama_hadiah: hRows[0].nama_hadiah,
        anggota_id: picked.id,
        nama: picked.nama,
        nip: picked.nip,
        jabatan: picked.jabatan,
        unit_kerja: picked.unit_kerja,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengundi" }, { status: 500 });
  }
}
