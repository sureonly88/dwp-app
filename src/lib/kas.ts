import pool from "./db";
import type { RowDataPacket } from "mysql2";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "./auth-token";

// ============================================================================
// Auth helpers — semua endpoint kas wajib login (admin / pengurus)
// ============================================================================

export async function requireSession(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 }) };
  }
  return { session, response: null };
}

export async function requireAdmin(req: NextRequest) {
  const { session, response } = await requireSession(req);
  if (response) return { session: null, response };
  if (session!.role !== "admin" && session!.role !== "operator") {
    return { session: null, response: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }) };
  }
  return { session, response: null };
}

// ============================================================================
// Generator nomor transaksi — TRX-YYYYMM-NNNN
// ============================================================================

export async function generateTransactionNumber(date: string): Promise<string> {
  const ym = date.replace(/-/g, "").slice(0, 6); // YYYYMM
  const prefix = `TRX-${ym}-`;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT transaction_number FROM cash_transactions
     WHERE transaction_number LIKE ?
     ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let next = 1;
  if (rows.length) {
    const last = String(rows[0].transaction_number);
    const seq = parseInt(last.slice(prefix.length), 10);
    if (!Number.isNaN(seq)) next = seq + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function generateSaleNumber(date: string): Promise<string> {
  const ym = date.replace(/-/g, "").slice(0, 6);
  const prefix = `SAL-${ym}-`;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT sale_number FROM sales
     WHERE sale_number LIKE ?
     ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let next = 1;
  if (rows.length) {
    const last = String(rows[0].sale_number);
    const seq = parseInt(last.slice(prefix.length), 10);
    if (!Number.isNaN(seq)) next = seq + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ============================================================================
// Saldo kas — hanya transaksi status='approved' yang dihitung
// ============================================================================

export interface KasSummary {
  total_income: number;
  total_expense: number;
  balance: number;
  pending_count: number;
  approved_count: number;
}

export async function getKasSummary(filter?: { from?: string; to?: string }): Promise<KasSummary> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter?.from) { where.push("transaction_date >= ?"); args.push(filter.from); }
  if (filter?.to) { where.push("transaction_date <= ?"); args.push(filter.to); }
  const dateClause = where.length ? `AND ${where.join(" AND ")}` : "";

  const [[row]] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN status='approved' AND type='income'  THEN amount ELSE 0 END), 0) AS total_income,
       COALESCE(SUM(CASE WHEN status='approved' AND type='expense' THEN amount ELSE 0 END), 0) AS total_expense,
       SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved_count
     FROM cash_transactions
     WHERE 1=1 ${dateClause}`,
    args
  );

  const total_income = Number(row.total_income);
  const total_expense = Number(row.total_expense);
  return {
    total_income,
    total_expense,
    balance: total_income - total_expense,
    pending_count: Number(row.pending_count ?? 0),
    approved_count: Number(row.approved_count ?? 0),
  };
}

// ============================================================================
// Format util
// ============================================================================

export function formatRupiah(n: number | string): string {
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "Rp 0";
  return "Rp " + num.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}
