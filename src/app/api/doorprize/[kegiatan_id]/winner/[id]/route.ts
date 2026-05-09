import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

// DELETE /api/doorprize/[kegiatan_id]/winner/[id] — batalkan pemenang dan hapus hadiah otomatis
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ kegiatan_id: string; id: string }> }
) {
  try {
    const { kegiatan_id, id } = await params;

    // Get hadiah_id first
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT hadiah_id FROM doorprize_winners WHERE id = ? AND kegiatan_id = ?`,
      [id, kegiatan_id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Pemenang tidak ditemukan" }, { status: 404 });
    }
    const hadiahId = rows[0].hadiah_id;

    // Delete winner first, then orphan hadiah
    await pool.execute<ResultSetHeader>(
      `DELETE FROM doorprize_winners WHERE id = ? AND kegiatan_id = ?`,
      [id, kegiatan_id]
    );
    await pool.execute(`DELETE FROM doorprize_hadiah WHERE id = ?`, [hadiahId]);

    return NextResponse.json({ message: "Pemenang dibatalkan" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal membatalkan" }, { status: 500 });
  }
}
