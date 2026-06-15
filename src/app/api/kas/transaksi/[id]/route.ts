import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureKasSourceFundColumn, getAutoSourceFundByCategoryCode, isValidSourceFund, requireSession } from "@/lib/kas";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/kas/transaksi/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession(req);
  if (response) return response;

  const { id } = await params;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT t.*, c.name AS category_name, c.code AS category_code,
            cu.username AS created_by_username, au.username AS approved_by_username
     FROM cash_transactions t
     INNER JOIN cash_categories c ON c.id = t.category_id
     LEFT JOIN auth_users cu ON cu.id = t.created_by
     LEFT JOIN auth_users au ON au.id = t.approved_by
     WHERE t.id = ?`,
    [id]
  );
  if (!rows.length) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

// PUT /api/kas/transaksi/[id] — hanya transaksi pending/draft yang boleh diedit
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession(req);
  if (response) return response;

  try {
    await ensureKasSourceFundColumn();

    const { response } = await requireAdmin(req);
    if (response) return response;
    const { id } = await params;
    const [[trx]] = await pool.execute<RowDataPacket[]>(
      `SELECT status, source_type FROM cash_transactions WHERE id=?`, [id]
    );
    if (!trx) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    if (trx.status === "approved") {
      return NextResponse.json({ error: "Transaksi yang sudah disetujui tidak dapat diubah" }, { status: 400 });
    }
    if (trx.source_type && trx.source_type !== "manual") {
      return NextResponse.json({ error: "Transaksi otomatis tidak dapat diubah" }, { status: 400 });
    }

    const body = await req.json();
    const date = String(body.transaction_date ?? "").trim();
    const categoryId = Number(body.category_id);
    const amount = Number(body.amount);
    const paymentMethod = body.payment_method ?? "Tunai";
    const description = body.description ? String(body.description).trim() : null;
    const referenceNumber = body.reference_number ? String(body.reference_number).trim() : null;
    const attachmentUrl = body.attachment_url ? String(body.attachment_url).trim() : null;
    const sourceFundRaw = body.source_fund;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
    }
    if (!categoryId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Kategori dan nominal wajib valid" }, { status: 400 });
    }

    const [[cat]] = await pool.execute<RowDataPacket[]>(
      `SELECT type, code FROM cash_categories WHERE id=? AND active=1`, [categoryId]
    );
    if (!cat) return NextResponse.json({ error: "Kategori tidak ditemukan / tidak aktif" }, { status: 400 });

    const autoSourceFund = getAutoSourceFundByCategoryCode(String(cat.code));
    const sourceFund = cat.type === "expense"
      ? (autoSourceFund ?? (isValidSourceFund(sourceFundRaw) ? sourceFundRaw : "umum"))
      : null;

    await pool.execute<ResultSetHeader>(
      `UPDATE cash_transactions
       SET transaction_date=?, category_id=?, amount=?, payment_method=?,
           description=?, reference_number=?, attachment_url=?, source_fund=?
       WHERE id=?`,
      [date, categoryId, amount, paymentMethod, description, referenceNumber, attachmentUrl, sourceFund, id]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal memperbarui transaksi" }, { status: 400 });
  }
}

// DELETE /api/kas/transaksi/[id] — admin bisa hapus apa pun, user hanya pending/draft miliknya
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession(req);
  if (response) return response;

  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { id } = await params;
    const [[trx]] = await pool.execute<RowDataPacket[]>(
      `SELECT status, created_by, source_type FROM cash_transactions WHERE id=?`, [id]
    );
    if (!trx) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });

    if (session!.role !== "admin" && trx.status === "approved") {
      return NextResponse.json({ error: "Transaksi yang sudah disetujui tidak dapat dihapus" }, { status: 403 });
    }

    // Jika transaksi terkait penjualan, lepas linkage di sales (cascade SET NULL)
    await pool.execute(`DELETE FROM cash_transactions WHERE id=?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus transaksi" }, { status: 400 });
  }
}
