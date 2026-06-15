import pool from "./db";
import type { RowDataPacket } from "mysql2";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "./auth-token";

let ensureKasSourceFundColumnPromise: Promise<void> | null = null;
let ensureKasExpenseCategoriesPromise: Promise<void> | null = null;

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

export const SOURCE_FUND_OPTIONS = [
  { code: "umum", label: "Umum" },
  { code: "iuran_anggota", label: "Iuran Arisan Anggota" },
  { code: "iuran_konsumsi_anggota", label: "Iuran Konsumsi Anggota" },
  { code: "iuran_pengurus", label: "Iuran Pengurus" },
] as const;

export type SourceFundCode = (typeof SOURCE_FUND_OPTIONS)[number]["code"];

export interface DanaIuranBalance {
  code: Exclude<SourceFundCode, "umum">;
  name: string;
  category_code: "IURAN_ANGGOTA" | "IURAN_KONSUMSI_ANGGOTA" | "IURAN_PENGURUS";
  saldo_awal: number;
  total_pemasukan: number;
  total_pengeluaran: number;
  saldo_akhir: number;
}

const DANA_IURAN_DEFS: Array<{
  code: DanaIuranBalance["code"];
  name: DanaIuranBalance["name"];
  category_code: DanaIuranBalance["category_code"];
}> = [
  { code: "iuran_anggota", name: "Iuran Arisan Anggota", category_code: "IURAN_ANGGOTA" },
  { code: "iuran_konsumsi_anggota", name: "Iuran Konsumsi Anggota", category_code: "IURAN_KONSUMSI_ANGGOTA" },
  { code: "iuran_pengurus", name: "Iuran Pengurus", category_code: "IURAN_PENGURUS" },
];

const VALID_SOURCE_FUNDS = new Set<string>(SOURCE_FUND_OPTIONS.map((item) => item.code));

interface DanaIuranAggregateRow extends RowDataPacket {
  in_iuran_anggota: number | string | null;
  out_iuran_anggota: number | string | null;
  in_iuran_konsumsi_anggota: number | string | null;
  out_iuran_konsumsi_anggota: number | string | null;
  in_iuran_pengurus: number | string | null;
  out_iuran_pengurus: number | string | null;
}

const AUTO_SOURCE_FUND_BY_CATEGORY_CODE: Partial<Record<string, SourceFundCode>> = {
  ARISAN_ANGGOTA: "iuran_anggota",
  ARISAN_PENGURUS: "iuran_pengurus",
};

export function isValidSourceFund(value: unknown): value is SourceFundCode {
  return typeof value === "string" && VALID_SOURCE_FUNDS.has(value);
}

export function getSourceFundLabel(code?: string | null): string {
  return SOURCE_FUND_OPTIONS.find((item) => item.code === code)?.label ?? "Umum";
}

export function getAutoSourceFundByCategoryCode(categoryCode?: string | null): SourceFundCode | null {
  if (!categoryCode) return null;
  return AUTO_SOURCE_FUND_BY_CATEGORY_CODE[categoryCode] ?? null;
}

export async function ensureKasSourceFundColumn() {
  if (!ensureKasSourceFundColumnPromise) {
    ensureKasSourceFundColumnPromise = (async () => {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SHOW COLUMNS FROM cash_transactions LIKE 'source_fund'`
      );

      if (!rows.length) {
        await pool.execute(
          `ALTER TABLE cash_transactions ADD COLUMN source_fund VARCHAR(40) NULL AFTER source_id`
        );
        await pool.execute(
          `UPDATE cash_transactions
              SET source_fund='umum'
            WHERE type='expense' AND (source_fund IS NULL OR source_fund='')`
        );
      }
    })().catch((error) => {
      ensureKasSourceFundColumnPromise = null;
      throw error;
    });
  }

  await ensureKasSourceFundColumnPromise;
}

export async function ensureKasExpenseCategories() {
  if (!ensureKasExpenseCategoriesPromise) {
    ensureKasExpenseCategoriesPromise = (async () => {
      await pool.execute(
        `INSERT IGNORE INTO cash_categories (code, name, type, is_system, description) VALUES
          ('ARISAN_ANGGOTA', 'Arisan Anggota', 'expense', 0, 'Pengeluaran untuk dana arisan anggota'),
          ('ARISAN_PENGURUS', 'Arisan Pengurus', 'expense', 0, 'Pengeluaran untuk dana arisan pengurus')`
      );
    })().catch((error) => {
      ensureKasExpenseCategoriesPromise = null;
      throw error;
    });
  }

  await ensureKasExpenseCategoriesPromise;
}

async function getDanaIuranAggregate(filter?: { from?: string; to?: string; before?: boolean }) {
  await ensureKasSourceFundColumn();

  const where: string[] = ["t.status='approved'"];
  const args: string[] = [];

  if (filter?.before) {
    if (filter.from) {
      where.push("t.transaction_date < ?");
      args.push(filter.from);
    } else {
      return {
        iuran_anggota: { pemasukan: 0, pengeluaran: 0 },
        iuran_konsumsi_anggota: { pemasukan: 0, pengeluaran: 0 },
        iuran_pengurus: { pemasukan: 0, pengeluaran: 0 },
      };
    }
  } else {
    if (filter?.from) {
      where.push("t.transaction_date >= ?");
      args.push(filter.from);
    }
    if (filter?.to) {
      where.push("t.transaction_date <= ?");
      args.push(filter.to);
    }
  }

  const [[row]] = await pool.execute<DanaIuranAggregateRow[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.type='income'  AND c.code='IURAN_ANGGOTA' THEN t.amount ELSE 0 END), 0) AS in_iuran_anggota,
       COALESCE(SUM(CASE WHEN t.type='expense' AND (t.source_fund='iuran_anggota' OR c.code='ARISAN_ANGGOTA') THEN t.amount ELSE 0 END), 0) AS out_iuran_anggota,
       COALESCE(SUM(CASE WHEN t.type='income'  AND c.code='IURAN_KONSUMSI_ANGGOTA' THEN t.amount ELSE 0 END), 0) AS in_iuran_konsumsi_anggota,
       COALESCE(SUM(CASE WHEN t.type='expense' AND t.source_fund='iuran_konsumsi_anggota' THEN t.amount ELSE 0 END), 0) AS out_iuran_konsumsi_anggota,
       COALESCE(SUM(CASE WHEN t.type='income'  AND c.code='IURAN_PENGURUS' THEN t.amount ELSE 0 END), 0) AS in_iuran_pengurus,
       COALESCE(SUM(CASE WHEN t.type='expense' AND (t.source_fund='iuran_pengurus' OR c.code='ARISAN_PENGURUS') THEN t.amount ELSE 0 END), 0) AS out_iuran_pengurus
     FROM cash_transactions t
     INNER JOIN cash_categories c ON c.id = t.category_id
     WHERE ${where.join(" AND ")}`,
    args
  );

  return {
    iuran_anggota: {
      pemasukan: Number(row.in_iuran_anggota ?? 0),
      pengeluaran: Number(row.out_iuran_anggota ?? 0),
    },
    iuran_konsumsi_anggota: {
      pemasukan: Number(row.in_iuran_konsumsi_anggota ?? 0),
      pengeluaran: Number(row.out_iuran_konsumsi_anggota ?? 0),
    },
    iuran_pengurus: {
      pemasukan: Number(row.in_iuran_pengurus ?? 0),
      pengeluaran: Number(row.out_iuran_pengurus ?? 0),
    },
  };
}

export async function getDanaIuranBalances(filter?: { from?: string; to?: string }): Promise<DanaIuranBalance[]> {
  const [awal, periode] = await Promise.all([
    filter?.from ? getDanaIuranAggregate({ from: filter.from, before: true }) : Promise.resolve({
      iuran_anggota: { pemasukan: 0, pengeluaran: 0 },
      iuran_konsumsi_anggota: { pemasukan: 0, pengeluaran: 0 },
      iuran_pengurus: { pemasukan: 0, pengeluaran: 0 },
    }),
    getDanaIuranAggregate({ from: filter?.from, to: filter?.to }),
  ]);

  return DANA_IURAN_DEFS.map((item) => {
    const awalDana = awal[item.code].pemasukan - awal[item.code].pengeluaran;
    const totalPemasukan = periode[item.code].pemasukan;
    const totalPengeluaran = periode[item.code].pengeluaran;

    return {
      code: item.code,
      name: item.name,
      category_code: item.category_code,
      saldo_awal: awalDana,
      total_pemasukan: totalPemasukan,
      total_pengeluaran: totalPengeluaran,
      saldo_akhir: awalDana + totalPemasukan - totalPengeluaran,
    };
  });
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
