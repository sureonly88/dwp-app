import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdmin } from "@/lib/kas";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// POST /api/kas/transaksi/[id]/approve  body: { action: "approve" | "reject" | "cancel" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireAdmin(req);
  if (response) return response;

  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action;

    const [[trx]] = await pool.execute<RowDataPacket[]>(
      `SELECT status FROM cash_transactions WHERE id=?`, [id]
    );
    if (!trx) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });

    let newStatus: string;
    if (action === "approve") {
      if (trx.status === "approved") return NextResponse.json({ error: "Sudah disetujui" }, { status: 400 });
      newStatus = "approved";
    } else if (action === "reject") {
      if (trx.status === "approved") return NextResponse.json({ error: "Tidak dapat menolak transaksi yang disetujui" }, { status: 400 });
      newStatus = "rejected";
    } else if (action === "cancel") {
      newStatus = "cancelled";
    } else {
      return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE cash_transactions
         SET status=?, approved_by=?, approved_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [newStatus, session!.id, id]
    );
    return NextResponse.json({ ok: true, status: newStatus });
  } catch {
    return NextResponse.json({ error: "Gagal memproses approval" }, { status: 400 });
  }
}
