import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireSession, getKasSummary } from "@/lib/kas";
import type { RowDataPacket } from "mysql2";

// GET /api/kas/dashboard
// Returns: saldo, pemasukan/pengeluaran bulan ini, tren 6 bulan, top kategori, transaksi pending
export async function GET(req: NextRequest) {
  const { response } = await requireSession(req);
  if (response) return response;

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${ym}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthEnd = `${ym}-${String(lastDay).padStart(2, "0")}`;

  // Tren 6 bulan terakhir
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const trendStartStr = `${trendStart.getFullYear()}-${String(trendStart.getMonth() + 1).padStart(2, "0")}-01`;

  const [allTime, monthSummary, trendRows, topIncome, topExpense, pending] = await Promise.all([
    getKasSummary(),
    getKasSummary({ from: monthStart, to: monthEnd }),
    pool.execute<RowDataPacket[]>(
      `SELECT DATE_FORMAT(transaction_date, '%Y-%m') AS ym,
              SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
         FROM cash_transactions
        WHERE status='approved' AND transaction_date >= ?
        GROUP BY ym
        ORDER BY ym ASC`,
      [trendStartStr]
    ).then(([r]) => r),
    pool.execute<RowDataPacket[]>(
      `SELECT c.id, c.name, c.code, SUM(t.amount) AS total
         FROM cash_transactions t
         INNER JOIN cash_categories c ON c.id = t.category_id
        WHERE t.status='approved' AND t.type='income'
          AND t.transaction_date BETWEEN ? AND ?
        GROUP BY c.id, c.name, c.code
        ORDER BY total DESC LIMIT 5`,
      [monthStart, monthEnd]
    ).then(([r]) => r),
    pool.execute<RowDataPacket[]>(
      `SELECT c.id, c.name, c.code, SUM(t.amount) AS total
         FROM cash_transactions t
         INNER JOIN cash_categories c ON c.id = t.category_id
        WHERE t.status='approved' AND t.type='expense'
          AND t.transaction_date BETWEEN ? AND ?
        GROUP BY c.id, c.name, c.code
        ORDER BY total DESC LIMIT 5`,
      [monthStart, monthEnd]
    ).then(([r]) => r),
    pool.execute<RowDataPacket[]>(
      `SELECT t.id, t.transaction_number, t.transaction_date, t.type, t.amount,
              c.name AS category_name, t.description
         FROM cash_transactions t
         INNER JOIN cash_categories c ON c.id = t.category_id
        WHERE t.status='pending'
        ORDER BY t.transaction_date DESC, t.id DESC
        LIMIT 10`
    ).then(([r]) => r),
  ]);

  return NextResponse.json({
    saldo_total: allTime.balance,
    bulan_ini: monthSummary,
    pending_count: allTime.pending_count,
    approved_count: allTime.approved_count,
    trend_6_bulan: trendRows.map((r) => ({
      ym: r.ym,
      income: Number(r.income),
      expense: Number(r.expense),
      net: Number(r.income) - Number(r.expense),
    })),
    top_pemasukan_bulan_ini: topIncome.map((r) => ({ id: r.id, code: r.code, name: r.name, total: Number(r.total) })),
    top_pengeluaran_bulan_ini: topExpense.map((r) => ({ id: r.id, code: r.code, name: r.name, total: Number(r.total) })),
    pending_transaksi: pending,
  });
}
