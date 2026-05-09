import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { kode, nama, deskripsi, aktif } = body;

    if (!kode?.trim() || !nama?.trim()) {
      return NextResponse.json({ error: "Kode dan Nama wajib diisi" }, { status: 400 });
    }

    const kodeUpper = String(kode).trim().toUpperCase().replace(/\s+/g, "_");

    const [result] = await pool.query(
      "UPDATE unit_kerja SET kode=?, nama=?, deskripsi=?, aktif=? WHERE id=?",
      [kodeUpper, nama.trim(), deskripsi?.trim() ?? null, aktif ?? 1, id]
    ) as [{ affectedRows: number }, unknown];

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Unit Kerja tidak ditemukan" }, { status: 404 });
    }

    const [rows] = await pool.query("SELECT * FROM unit_kerja WHERE id = ?", [id]);
    return NextResponse.json((rows as unknown[])[0]);
  } catch (err: unknown) {
    console.error("PUT /api/unit-kerja/[id] error:", err);
    const mysqlErr = err as { code?: string };
    if (mysqlErr.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Kode Unit Kerja sudah digunakan" }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal memperbarui data" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    // Cek apakah masih dipakai oleh anggota
    const [used] = await pool.query(
      "SELECT COUNT(*) as count FROM anggota WHERE unit_kerja = (SELECT nama FROM unit_kerja WHERE id = ?)",
      [id]
    ) as [{ count: number }[], unknown];

    if (used[0].count > 0) {
      return NextResponse.json(
        { error: `Unit Kerja masih digunakan oleh ${used[0].count} anggota dan tidak dapat dihapus` },
        { status: 409 }
      );
    }

    const [result] = await pool.query("DELETE FROM unit_kerja WHERE id = ?", [id]) as [{ affectedRows: number }, unknown];

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Unit Kerja tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/unit-kerja/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus data" }, { status: 500 });
  }
}
