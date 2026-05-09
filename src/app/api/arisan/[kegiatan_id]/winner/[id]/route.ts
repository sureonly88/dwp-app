import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader } from "mysql2";

// DELETE /api/arisan/[kegiatan_id]/winner/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ kegiatan_id: string; id: string }> }
) {
  try {
    const { kegiatan_id, id } = await params;
    const [res] = await pool.execute<ResultSetHeader>(
      `DELETE FROM arisan_winners WHERE id = ? AND kegiatan_id = ?`,
      [id, kegiatan_id]
    );
    if (res.affectedRows === 0) {
      return NextResponse.json({ error: "Pemenang tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Pemenang dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
