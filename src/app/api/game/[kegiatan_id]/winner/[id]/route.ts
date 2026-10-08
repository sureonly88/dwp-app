import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { requireAdmin } from "@/lib/admin-auth";

// DELETE /api/game/[kegiatan_id]/winner/[id] — batalkan peserta terpilih dan hapus slot otomatis
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
      `SELECT hadiah_id, game_setup_id FROM game_winners WHERE id = ? AND kegiatan_id = ?`,
      [id, kegiatan_id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ error: "Peserta Terpilih tidak ditemukan" }, { status: 404 });
    }
    const hadiahId = rows[0].hadiah_id;
    const gameSetupId = rows[0].game_setup_id;

    // Delete winner first, then orphan slot
    await conn.execute<ResultSetHeader>(
      `DELETE FROM game_winners WHERE id = ? AND kegiatan_id = ?`,
      [id, kegiatan_id]
    );
    await conn.execute(`DELETE FROM game_hadiah WHERE id = ?`, [hadiahId]);

    const [hadiahRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id
       FROM game_hadiah
       WHERE kegiatan_id = ?
         AND game_setup_id = ?
       ORDER BY urutan ASC, id ASC`,
      [kegiatan_id, gameSetupId]
    );

    for (const [index, hadiah] of hadiahRows.entries()) {
      const urutanBaru = index + 1;
      await conn.execute<ResultSetHeader>(
        `UPDATE game_hadiah
         SET urutan = ?,
             nama_hadiah = CASE
               WHEN nama_hadiah REGEXP '^(Hadiah|Pemenang|Peserta Terpilih) ke-[0-9]+$' THEN ?
               ELSE nama_hadiah
             END
         WHERE id = ?`,
        [urutanBaru, `Peserta Terpilih ke-${urutanBaru}`, hadiah.id]
      );
    }

    await conn.commit();

    return NextResponse.json({ message: "Peserta Terpilih dibatalkan" });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    return NextResponse.json({ error: "Gagal membatalkan" }, { status: 500 });
  } finally {
    conn?.release();
  }
}
