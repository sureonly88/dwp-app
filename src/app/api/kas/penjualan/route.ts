import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireSession, generateSaleNumber, generateTransactionNumber } from "@/lib/kas";
import type { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import { requireAdmin } from "@/lib/admin-auth";

interface SaleItemInput {
  item_name: string;
  quantity: number;
  unit_price: number;
}

// GET /api/kas/penjualan?from=&to=&search=&page=&limit=
export async function GET(req: NextRequest) {
  const { response } = await requireSession(req);
  if (response) return response;

  const sp = new URL(req.url).searchParams;
  const where: string[] = [];
  const args: (string | number)[] = [];
  const from = sp.get("from"); if (from) { where.push("s.sale_date >= ?"); args.push(from); }
  const to = sp.get("to");     if (to)   { where.push("s.sale_date <= ?"); args.push(to); }
  const search = sp.get("search");
  if (search) {
    where.push("(s.sale_number LIKE ? OR s.buyer_name LIKE ? OR s.notes LIKE ?)");
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const limit = Math.max(1, Math.min(200, parseInt(sp.get("limit") ?? "50", 10)));
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const offset = (page - 1) * limit;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[count]] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM sales s ${whereSql}`, args
  );

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.sale_number, s.sale_date, s.buyer_name, s.payment_method,
            s.total_amount, s.notes, s.posted_to_kas, s.cash_trx_id,
            t.status AS cash_status,
            (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS item_count,
            s.created_at
       FROM sales s
       LEFT JOIN cash_transactions t ON t.id = s.cash_trx_id
       ${whereSql}
       ORDER BY s.sale_date DESC, s.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
    args
  );

  return NextResponse.json({ data: rows, total: Number(count.c), page, limit });
}

// POST /api/kas/penjualan
// body: { sale_date, buyer_name?, payment_method?, notes?, items: [{ item_name, quantity, unit_price }] }
// Otomatis membuat cash_transaction (income, kategori PENJUALAN_BARANG, status=pending)
export async function POST(req: NextRequest) {
  const { session, response } = await requireSession(req);
  if (response) return response;

  let conn: PoolConnection | undefined;
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const body = await req.json();
    const saleDate = String(body.sale_date ?? "").trim();
    const buyerName = body.buyer_name ? String(body.buyer_name).trim() : null;
    const paymentMethod = body.payment_method ?? "Tunai";
    const notes = body.notes ? String(body.notes).trim() : null;
    const items: SaleItemInput[] = Array.isArray(body.items) ? body.items : [];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
      return NextResponse.json({ error: "Tanggal penjualan tidak valid" }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Minimal 1 item" }, { status: 400 });
    }

    let total = 0;
    const cleanedItems = items.map((it) => {
      const name = String(it.item_name ?? "").trim();
      const qty = Number(it.quantity);
      const price = Number(it.unit_price);
      if (!name || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
        throw new Error("Item tidak valid (nama, qty > 0, harga ≥ 0)");
      }
      const subtotal = qty * price;
      total += subtotal;
      return { item_name: name, quantity: qty, unit_price: price, subtotal };
    });

    if (total <= 0) {
      return NextResponse.json({ error: "Total penjualan harus > 0" }, { status: 400 });
    }

    // Cari kategori PENJUALAN_BARANG
    const [[cat]] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM cash_categories WHERE code='PENJUALAN_BARANG'`
    );
    if (!cat) return NextResponse.json({ error: "Kategori PENJUALAN_BARANG tidak ada" }, { status: 500 });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const saleNumber = await generateSaleNumber(saleDate);
    const [saleRes] = await conn.execute<ResultSetHeader>(
      `INSERT INTO sales (sale_number, sale_date, buyer_name, payment_method,
                          total_amount, notes, posted_to_kas, created_by)
       VALUES (?,?,?,?,?,?,1,?)`,
      [saleNumber, saleDate, buyerName, paymentMethod, total, notes, session!.id]
    );
    const saleId = saleRes.insertId;

    for (const it of cleanedItems) {
      await conn.execute<ResultSetHeader>(
        `INSERT INTO sale_items (sale_id, item_name, quantity, unit_price, subtotal)
         VALUES (?,?,?,?,?)`,
        [saleId, it.item_name, it.quantity, it.unit_price, it.subtotal]
      );
    }

    // Buat transaksi kas terkait (status=pending → wajib approval)
    const trxNumber = await generateTransactionNumber(saleDate);
    const desc = `Penjualan ${saleNumber}${buyerName ? ` — ${buyerName}` : ""}`;
    const [trxRes] = await conn.execute<ResultSetHeader>(
      `INSERT INTO cash_transactions
        (transaction_number, transaction_date, type, category_id, amount,
         payment_method, description, status, source_type, source_id, created_by)
       VALUES (?,?, 'income', ?, ?, ?, ?, 'pending', 'sale', ?, ?)`,
      [trxNumber, saleDate, cat.id, total, paymentMethod, desc, String(saleId), session!.id]
    );
    const trxId = trxRes.insertId;

    await conn.execute(`UPDATE sales SET cash_trx_id=? WHERE id=?`, [trxId, saleId]);

    await conn.commit();
    return NextResponse.json({ id: saleId, sale_number: saleNumber, cash_trx_id: trxId, total }, { status: 201 });
  } catch (e) {
    if (conn) await conn.rollback();
    return NextResponse.json({ error: (e as Error).message ?? "Gagal menyimpan penjualan" }, { status: 400 });
  } finally {
    if (conn) conn.release();
  }
}
