import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { requireAdmin } from "@/lib/admin-auth";

// DELETE /api/arisan/[kegiatan_id]/winner/[id]
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

    const [res] = await conn.execute<ResultSetHeader>(
      `DELETE FROM arisan_winners WHERE id = ? AND kegiatan_id = ?`,
      [id, kegiatan_id]
    );
    if (res.affectedRows === 0) {
      await conn.rollback();
      return NextResponse.json({ error: "Pemenang tidak ditemukan" }, { status: 404 });
    }

    const [winnerRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id
       FROM arisan_winners
       WHERE kegiatan_id = ?
       ORDER BY urutan ASC, id ASC`,
      [kegiatan_id]
    );

    for (const [index, winner] of winnerRows.entries()) {
      await conn.execute<ResultSetHeader>(
        `UPDATE arisan_winners
         SET urutan = ?
         WHERE id = ?`,
        [index + 1, winner.id]
      );
    }

    await conn.commit();
    return NextResponse.json({ message: "Pemenang dihapus" });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus" }, { status: 500 });
  } finally {
    conn?.release();
  }
}
