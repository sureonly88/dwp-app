import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireSession, generateTransactionNumber } from "@/lib/kas";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ============================================================================
// GET /api/kas/transaksi
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD
//   &type=income|expense
//   &status=draft|pending|approved|rejected|cancelled
//   &category_id=...
//   &source_type=...
//   &search=...
//   &page=1&limit=20
// ============================================================================
export async function GET(req: NextRequest) {
  const { response } = await requireSession(req);
  if (response) return response;

  const sp = new URL(req.url).searchParams;
  const where: string[] = [];
  const args: (string | number)[] = [];

  const from = sp.get("from"); if (from) { where.push("t.transaction_date >= ?"); args.push(from); }
  const to = sp.get("to");     if (to)   { where.push("t.transaction_date <= ?"); args.push(to); }
  const type = sp.get("type"); if (type === "income" || type === "expense") { where.push("t.type = ?"); args.push(type); }
  const status = sp.get("status"); if (status) { where.push("t.status = ?"); args.push(status); }
  const cat = sp.get("category_id"); if (cat) { where.push("t.category_id = ?"); args.push(cat); }
  const src = sp.get("source_type"); if (src) { where.push("t.source_type = ?"); args.push(src); }
  const search = sp.get("search");
  if (search) {
    where.push("(t.transaction_number LIKE ? OR t.description LIKE ? OR t.reference_number LIKE ?)");
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const limit = Math.max(1, Math.min(200, parseInt(sp.get("limit") ?? "50", 10)));
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const offset = (page - 1) * limit;

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[count]] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM cash_transactions t ${whereSql}`, args
  );

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT t.id, t.transaction_number, t.transaction_date, t.type, t.category_id,
            c.name AS category_name, c.code AS category_code,
            t.amount, t.payment_method, t.description, t.reference_number,
            t.attachment_url, t.status, t.source_type, t.source_id,
            t.created_by, cu.username AS created_by_username,
            t.approved_by, au.username AS approved_by_username,
            t.approved_at, t.created_at
     FROM cash_transactions t
     INNER JOIN cash_categories c ON c.id = t.category_id
     LEFT JOIN auth_users cu ON cu.id = t.created_by
     LEFT JOIN auth_users au ON au.id = t.approved_by
     ${whereSql}
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    args
  );

  return NextResponse.json({ data: rows, total: Number(count.c), page, limit });
}

// ============================================================================
// POST /api/kas/transaksi — buat transaksi manual (status default: pending)
// body: { transaction_date, type, category_id, amount, payment_method, description?, reference_number?, attachment_url? }
// ============================================================================
export async function POST(req: NextRequest) {
  const { session, response } = await requireSession(req);
  if (response) return response;

  try {
    const body = await req.json();
    const date = String(body.transaction_date ?? "").trim();
    const type = body.type;
    const categoryId = Number(body.category_id);
    const amount = Number(body.amount);
    const paymentMethod = body.payment_method ?? "Tunai";
    const description = body.description ? String(body.description).trim() : null;
    const referenceNumber = body.reference_number ? String(body.reference_number).trim() : null;
    const attachmentUrl = body.attachment_url ? String(body.attachment_url).trim() : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
    }
    if (type !== "income" && type !== "expense") {
      return NextResponse.json({ error: "Tipe wajib income/expense" }, { status: 400 });
    }
    if (!categoryId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Kategori dan nominal wajib valid" }, { status: 400 });
    }

    // Validasi kategori sesuai tipe
    const [[cat]] = await pool.execute<RowDataPacket[]>(
      `SELECT type, code FROM cash_categories WHERE id=? AND active=1`, [categoryId]
    );
    if (!cat) return NextResponse.json({ error: "Kategori tidak ditemukan / tidak aktif" }, { status: 400 });
    if (cat.type !== type) {
      return NextResponse.json({ error: "Tipe kategori tidak sesuai" }, { status: 400 });
    }
    // Cegah pembuatan manual dengan kategori sistem (iuran/penjualan) — harus via posting
    if (cat.code === "IURAN_ANGGOTA" || cat.code === "IURAN_PENGURUS" || cat.code === "PENJUALAN_BARANG") {
      return NextResponse.json({
        error: "Kategori ini hanya bisa diposting otomatis dari modul terkait (Iuran / Penjualan)"
      }, { status: 400 });
    }

    const trxNumber = await generateTransactionNumber(date);
    const [r] = await pool.execute<ResultSetHeader>(
      `INSERT INTO cash_transactions
        (transaction_number, transaction_date, type, category_id, amount,
         payment_method, description, reference_number, attachment_url,
         status, source_type, created_by)
       VALUES (?,?,?,?,?,?,?,?,?, 'pending', 'manual', ?)`,
      [trxNumber, date, type, categoryId, amount, paymentMethod, description, referenceNumber, attachmentUrl, session!.id]
    );

    return NextResponse.json({ id: r.insertId, transaction_number: trxNumber }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan transaksi" }, { status: 400 });
  }
}
