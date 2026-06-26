import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { requireAdmin } from "@/lib/admin-auth";

// DELETE /api/doorprize/[kegiatan_id]/winner/[id] — batalkan pemenang dan hapus hadiah otomatis
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ kegiatan_id: string; id: string }> }
) {
  const { response } = await requireAdmin(req);
  if (response) return response;
  let conn: PoolConnection | undefined;
  try {
    const { kegiatan_id, id } = await params;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Get hadiah_id first
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT hadiah_id FROM doorprize_winners WHERE id = ? AND kegiatan_id = ?`,
      [id, kegiatan_id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ error: "Pemenang tidak ditemukan" }, { status: 404 });
    }
    const hadiahId = rows[0].hadiah_id;

    // Delete winner first, then orphan hadiah
    await conn.execute<ResultSetHeader>(
      `DELETE FROM doorprize_winners WHERE id = ? AND kegiatan_id = ?`,
      [id, kegiatan_id]
    );
    await conn.execute(`DELETE FROM doorprize_hadiah WHERE id = ?`, [hadiahId]);

    const [hadiahRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id
       FROM doorprize_hadiah
       WHERE kegiatan_id = ?
       ORDER BY urutan ASC, id ASC`,
      [kegiatan_id]
    );

    for (const [index, hadiah] of hadiahRows.entries()) {
      const urutanBaru = index + 1;
      await conn.execute<ResultSetHeader>(
        `UPDATE doorprize_hadiah
         SET urutan = ?,
             nama_hadiah = CASE
               WHEN nama_hadiah REGEXP '^Hadiah ke-[0-9]+$' THEN ?
               ELSE nama_hadiah
             END
         WHERE id = ?`,
        [urutanBaru, `Hadiah ke-${urutanBaru}`, hadiah.id]
      );
    }

    await conn.commit();

    return NextResponse.json({ message: "Pemenang dibatalkan" });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    return NextResponse.json({ error: "Gagal membatalkan" }, { status: 500 });
  } finally {
    conn?.release();
  }
}
