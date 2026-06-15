import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureKasSourceFundColumn, getDanaIuranBalances, getSourceFundLabel, requireSession } from "@/lib/kas";
import type { RowDataPacket } from "mysql2";

// GET /api/kas/buku?from=YYYY-MM-DD&to=YYYY-MM-DD
// Buku kas dengan saldo berjalan (running balance), HANYA transaksi approved
export async function GET(req: NextRequest) {
  const { response } = await requireSession(req);
  if (response) return response;

  await ensureKasSourceFundColumn();

  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");

  const where: string[] = ["t.status='approved'"];
  const args: (string | number)[] = [];
  if (from) { where.push("t.transaction_date >= ?"); args.push(from); }
  if (to)   { where.push("t.transaction_date <= ?"); args.push(to); }

  // Saldo awal (sebelum 'from')
  let saldoAwal = 0;
  if (from) {
    const [[row]] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS saldo
       FROM cash_transactions
       WHERE status='approved' AND transaction_date < ?`,
      [from]
    );
    saldoAwal = Number(row.saldo);
  }

  const [rows, danaIuran] = await Promise.all([
    pool.execute<RowDataPacket[]>(
    `SELECT t.id, t.transaction_number, t.transaction_date, t.type, t.amount,
            t.description, t.payment_method, t.reference_number,
            c.name AS category_name, c.code AS category_code,
            t.source_type, t.source_fund
       FROM cash_transactions t
       INNER JOIN cash_categories c ON c.id = t.category_id
       WHERE ${where.join(" AND ")}
       ORDER BY t.transaction_date ASC, t.id ASC`,
    args
    ).then(([result]) => result),
    getDanaIuranBalances({ from: from ?? undefined, to: to ?? undefined }),
  ]);

  let running = saldoAwal;
  const data = rows.map((r) => {
    const amt = Number(r.amount);
    const debit = r.type === "income" ? amt : 0;
    const kredit = r.type === "expense" ? amt : 0;
    running = running + debit - kredit;
    return {
      id: r.id,
      transaction_number: r.transaction_number,
      transaction_date: r.transaction_date,
      type: r.type,
      category_name: r.category_name,
      category_code: r.category_code,
      description: r.description,
      payment_method: r.payment_method,
      reference_number: r.reference_number,
      source_type: r.source_type,
      source_fund: r.source_fund,
      source_fund_label: getSourceFundLabel(r.source_fund),
      debit,
      kredit,
      saldo: running,
    };
  });

  const totalDebit = data.reduce((s, r) => s + r.debit, 0);
  const totalKredit = data.reduce((s, r) => s + r.kredit, 0);

  return NextResponse.json({
    saldo_awal: saldoAwal,
    saldo_akhir: running,
    total_debit: totalDebit,
    total_kredit: totalKredit,
    dana_iuran: danaIuran,
    data,
  });
}
