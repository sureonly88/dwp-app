import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireSession } from "@/lib/kas";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

// GET /api/kas/penjualan/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession(req);
  if (response) return response;

  const { id } = await params;
  const [saleRows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.*, t.status AS cash_status, t.transaction_number AS cash_transaction_number
       FROM sales s
       LEFT JOIN cash_transactions t ON t.id = s.cash_trx_id
      WHERE s.id = ?`,
    [id]
  );
  if (!saleRows.length) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const [items] = await pool.execute<RowDataPacket[]>(
    `SELECT id, item_name, quantity, unit_price, subtotal FROM sale_items WHERE sale_id=? ORDER BY id ASC`,
    [id]
  );

  return NextResponse.json({ ...saleRows[0], items });
}

// DELETE /api/kas/penjualan/[id]
// Hapus penjualan + transaksi kas terkait. Jika cash_trx sudah approved → tolak.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession(req);
  if (response) return response;

  let conn: PoolConnection | undefined;
  try {
    const { id } = await params;
    const [[sale]] = await pool.execute<RowDataPacket[]>(
      `SELECT s.id, s.cash_trx_id, s.created_by, t.status AS cash_status
         FROM sales s LEFT JOIN cash_transactions t ON t.id=s.cash_trx_id
        WHERE s.id=?`,
      [id]
    );
    if (!sale) return NextResponse.json({ error: "Penjualan tidak ditemukan" }, { status: 404 });

    if (session!.role !== "admin") {
      if (sale.cash_status === "approved") {
        return NextResponse.json({ error: "Transaksi kas sudah disetujui — minta admin untuk menghapus" }, { status: 403 });
      }
      if (Number(sale.created_by) !== session!.id) {
        return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
      }
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    if (sale.cash_trx_id) {
      await conn.execute(`DELETE FROM cash_transactions WHERE id=?`, [sale.cash_trx_id]);
    }
    await conn.execute(`DELETE FROM sales WHERE id=?`, [id]);
    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch {
    if (conn) await conn.rollback();
    return NextResponse.json({ error: "Gagal menghapus penjualan" }, { status: 400 });
  } finally {
    if (conn) conn.release();
  }
}
