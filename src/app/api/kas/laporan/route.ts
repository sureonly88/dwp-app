import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireSession } from "@/lib/kas";
import type { RowDataPacket } from "mysql2";

// GET /api/kas/laporan?bulan=5&tahun=2026
// Laporan kas bulanan: saldo awal, total per kategori income/expense, daftar transaksi, saldo akhir
export async function GET(req: NextRequest) {
  const { response } = await requireSession(req);
  if (response) return response;

  const sp = new URL(req.url).searchParams;
  const bulan = Math.max(1, Math.min(12, parseInt(sp.get("bulan") ?? `${new Date().getMonth() + 1}`, 10)));
  const tahun = Math.max(2000, parseInt(sp.get("tahun") ?? `${new Date().getFullYear()}`, 10));

  const monthStart = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const lastDay = new Date(tahun, bulan, 0).getDate();
  const monthEnd = `${tahun}-${String(bulan).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  await pool.execute(
    `INSERT IGNORE INTO cash_categories (code, name, type, is_system, description) VALUES
      ('IURAN_KONSUMSI_ANGGOTA', 'Iuran Konsumsi Anggota', 'income', 1, 'Posting rekap iuran konsumsi anggota dari modul Iuran')`
  );
  await pool.execute(
    `UPDATE cash_categories
        SET name='Iuran Arisan Anggota', description='Posting rekap iuran arisan anggota dari modul Iuran'
      WHERE code='IURAN_ANGGOTA'`
  );

  const reportableStatusSql = `(
    t.status='approved'
    OR (t.status='pending' AND t.source_type IN ('iuran_anggota','iuran_konsumsi_anggota','iuran_pengurus'))
  )`;

  const [[awal], catIncome, catExpense, daftar] = await Promise.all([
    pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS saldo_awal
       FROM cash_transactions t
       WHERE ${reportableStatusSql} AND transaction_date < ?`,
      [monthStart]
    ).then(([r]) => r),
    pool.execute<RowDataPacket[]>(
      `SELECT c.id, c.name, c.code, COALESCE(SUM(t.amount),0) AS total, COUNT(t.id) AS jumlah
         FROM cash_categories c
         LEFT JOIN cash_transactions t
           ON t.category_id=c.id AND ${reportableStatusSql} AND t.type='income'
          AND t.transaction_date BETWEEN ? AND ?
        WHERE c.type='income'
        GROUP BY c.id, c.name, c.code
        HAVING COUNT(t.id) > 0 OR MAX(c.is_system) = 1
        ORDER BY total DESC`,
      [monthStart, monthEnd]
    ).then(([r]) => r),
    pool.execute<RowDataPacket[]>(
      `SELECT c.id, c.name, c.code, COALESCE(SUM(t.amount),0) AS total, COUNT(t.id) AS jumlah
         FROM cash_categories c
         LEFT JOIN cash_transactions t
           ON t.category_id=c.id AND ${reportableStatusSql} AND t.type='expense'
          AND t.transaction_date BETWEEN ? AND ?
        WHERE c.type='expense'
        GROUP BY c.id, c.name, c.code
        HAVING jumlah > 0
        ORDER BY total DESC`,
      [monthStart, monthEnd]
    ).then(([r]) => r),
    pool.execute<RowDataPacket[]>(
      `SELECT t.id, t.transaction_number, t.transaction_date, t.type, t.amount, t.status,
              t.description, t.payment_method, t.reference_number,
              c.name AS category_name
         FROM cash_transactions t
         INNER JOIN cash_categories c ON c.id = t.category_id
        WHERE ${reportableStatusSql} AND t.transaction_date BETWEEN ? AND ?
        ORDER BY t.transaction_date ASC, t.id ASC`,
      [monthStart, monthEnd]
    ).then(([r]) => r),
  ]);

  const totalIncome = catIncome.reduce((s, r) => s + Number(r.total), 0);
  const totalExpense = catExpense.reduce((s, r) => s + Number(r.total), 0);
  const saldoAwal = Number(awal.saldo_awal);
  const saldoAkhir = saldoAwal + totalIncome - totalExpense;

  return NextResponse.json({
    periode: { bulan, tahun, awal: monthStart, akhir: monthEnd },
    saldo_awal: saldoAwal,
    saldo_akhir: saldoAkhir,
    total_income: totalIncome,
    total_expense: totalExpense,
    rekap_pemasukan: catIncome.map((r) => ({ id: r.id, code: r.code, name: r.name, total: Number(r.total), jumlah: Number(r.jumlah) })),
    rekap_pengeluaran: catExpense.map((r) => ({ id: r.id, code: r.code, name: r.name, total: Number(r.total), jumlah: Number(r.jumlah) })),
    transaksi: daftar,
  });
}
