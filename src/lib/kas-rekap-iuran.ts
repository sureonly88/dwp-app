import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { ensureKasSourceFundColumn, getSourceFundLabel } from "@/lib/kas";

const DEFAULT_SERAH_TERIMA_DATE = "2026-05-01";

const BULAN_LABELS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const REKAP_IURAN_FUND_DEFS = [
  { code: "iuran_anggota", name: "Kas Iuran Arisan Anggota" },
  { code: "iuran_konsumsi_anggota", name: "Kas Iuran Konsumsi" },
  { code: "iuran_pengurus", name: "Kas Iuran Pengurus" },
] as const;

export type RekapIuranFundCode = (typeof REKAP_IURAN_FUND_DEFS)[number]["code"];

interface AggregateRow extends RowDataPacket {
  ym?: string;
  in_iuran_anggota: number | string | null;
  out_iuran_anggota: number | string | null;
  in_iuran_konsumsi_anggota: number | string | null;
  out_iuran_konsumsi_anggota: number | string | null;
  in_iuran_pengurus: number | string | null;
  out_iuran_pengurus: number | string | null;
}

interface TransactionRow extends RowDataPacket {
  id: number;
  transaction_number: string;
  transaction_date: string;
  type: "income" | "expense";
  amount: number | string;
  description: string | null;
  category_name: string;
  category_code: string;
  source_fund: string | null;
  dana_code: RekapIuranFundCode;
}

export interface RekapIuranFundRow {
  code: RekapIuranFundCode;
  name: string;
  saldo_awal: number;
  total_pemasukan: number;
  total_pengeluaran: number;
  saldo_akhir: number;
}

export interface RekapIuranMonthlyRow {
  ym: string;
  label: string;
  funds: RekapIuranFundRow[];
  total_pemasukan: number;
  total_pengeluaran: number;
  saldo_akhir: number;
}

export interface RekapIuranKasResult {
  periode: {
    bulan_awal: number;
    tahun_awal: number;
    bulan_akhir: number;
    tahun_akhir: number;
    awal: string;
    akhir: string;
    label_awal: string;
    label_akhir: string;
    label: string;
    tanggal_serah_terima: string;
  };
  summary: RekapIuranFundRow[];
  total: {
    saldo_awal: number;
    total_pemasukan: number;
    total_pengeluaran: number;
    saldo_akhir: number;
  };
  monthly: RekapIuranMonthlyRow[];
  transaksi: Array<{
    id: number;
    transaction_number: string;
    transaction_date: string;
    type: "income" | "expense";
    amount: number;
    description: string | null;
    category_name: string;
    category_code: string;
    source_fund: string | null;
    source_fund_label: string;
    dana_code: RekapIuranFundCode;
    dana_name: string;
  }>;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

function isValidDate(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(year, month, 0).getDate();
}

function parseMonthYear(searchParams: URLSearchParams, prefix: "awal" | "akhir", fallback: Date) {
  const bulan = Number(searchParams.get(`bulan_${prefix}`) ?? fallback.getMonth() + 1);
  const tahun = Number(searchParams.get(`tahun_${prefix}`) ?? fallback.getFullYear());

  return {
    bulan: Math.max(1, Math.min(12, Number.isFinite(bulan) ? Math.trunc(bulan) : fallback.getMonth() + 1)),
    tahun: Math.max(2000, Number.isFinite(tahun) ? Math.trunc(tahun) : fallback.getFullYear()),
  };
}

function monthLabel(tahun: number, bulan: number) {
  return `${BULAN_LABELS[bulan - 1]} ${tahun}`;
}

function addMonth(tahun: number, bulan: number) {
  if (bulan === 12) return { tahun: tahun + 1, bulan: 1 };
  return { tahun, bulan: bulan + 1 };
}

function aggregateFromRow(row?: AggregateRow) {
  return {
    iuran_anggota: {
      pemasukan: Number(row?.in_iuran_anggota ?? 0),
      pengeluaran: Number(row?.out_iuran_anggota ?? 0),
    },
    iuran_konsumsi_anggota: {
      pemasukan: Number(row?.in_iuran_konsumsi_anggota ?? 0),
      pengeluaran: Number(row?.out_iuran_konsumsi_anggota ?? 0),
    },
    iuran_pengurus: {
      pemasukan: Number(row?.in_iuran_pengurus ?? 0),
      pengeluaran: Number(row?.out_iuran_pengurus ?? 0),
    },
  };
}

async function getDefaultSerahTerimaDate() {
  try {
    await pool.execute(
      `INSERT IGNORE INTO app_settings (key_name, value, label)
       VALUES ('tanggal_serah_terima_iuran', ?, 'Tanggal Serah Terima Iuran')`,
      [DEFAULT_SERAH_TERIMA_DATE]
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT value FROM app_settings WHERE key_name='tanggal_serah_terima_iuran' LIMIT 1`
    );
    const value = rows[0]?.value ? String(rows[0].value).slice(0, 10) : DEFAULT_SERAH_TERIMA_DATE;
    return isValidDate(value) ? value : DEFAULT_SERAH_TERIMA_DATE;
  } catch {
    return DEFAULT_SERAH_TERIMA_DATE;
  }
}

async function getAggregate(whereSql: string, args: string[]) {
  const [[row]] = await pool.execute<AggregateRow[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.type='income' AND c.code='IURAN_ANGGOTA' THEN t.amount ELSE 0 END), 0) AS in_iuran_anggota,
       COALESCE(SUM(CASE WHEN t.type='expense' AND (t.source_fund='iuran_anggota' OR c.code='ARISAN_ANGGOTA') THEN t.amount ELSE 0 END), 0) AS out_iuran_anggota,
       COALESCE(SUM(CASE WHEN t.type='income' AND c.code='IURAN_KONSUMSI_ANGGOTA' THEN t.amount ELSE 0 END), 0) AS in_iuran_konsumsi_anggota,
       COALESCE(SUM(CASE WHEN t.type='expense' AND t.source_fund='iuran_konsumsi_anggota' THEN t.amount ELSE 0 END), 0) AS out_iuran_konsumsi_anggota,
       COALESCE(SUM(CASE WHEN t.type='income' AND c.code='IURAN_PENGURUS' THEN t.amount ELSE 0 END), 0) AS in_iuran_pengurus,
       COALESCE(SUM(CASE WHEN t.type='expense' AND (t.source_fund='iuran_pengurus' OR c.code='ARISAN_PENGURUS') THEN t.amount ELSE 0 END), 0) AS out_iuran_pengurus
     FROM cash_transactions t
     INNER JOIN cash_categories c ON c.id = t.category_id
     WHERE t.status='approved' AND ${whereSql}`,
    args
  );

  return aggregateFromRow(row);
}

export async function getRekapIuranKas(searchParams: URLSearchParams): Promise<RekapIuranKasResult> {
  await ensureKasSourceFundColumn();

  const serahTerimaDate = await getDefaultSerahTerimaDate();
  const serahTerima = new Date(`${serahTerimaDate}T00:00:00`);
  const now = new Date();

  const awal = parseMonthYear(searchParams, "awal", serahTerima);
  const akhir = parseMonthYear(searchParams, "akhir", now);
  const fromDate = `${awal.tahun}-${pad2(awal.bulan)}-01`;
  const lastDay = new Date(akhir.tahun, akhir.bulan, 0).getDate();
  const toDate = `${akhir.tahun}-${pad2(akhir.bulan)}-${pad2(lastDay)}`;

  if (fromDate > toDate) {
    throw new Error("Periode awal tidak boleh melewati periode akhir");
  }

  const [saldoAwalAggregate, monthlyRows, transactionRows] = await Promise.all([
    getAggregate("t.transaction_date < ?", [fromDate]),
    pool.execute<AggregateRow[]>(
      `SELECT
         DATE_FORMAT(t.transaction_date, '%Y-%m') AS ym,
         COALESCE(SUM(CASE WHEN t.type='income' AND c.code='IURAN_ANGGOTA' THEN t.amount ELSE 0 END), 0) AS in_iuran_anggota,
         COALESCE(SUM(CASE WHEN t.type='expense' AND (t.source_fund='iuran_anggota' OR c.code='ARISAN_ANGGOTA') THEN t.amount ELSE 0 END), 0) AS out_iuran_anggota,
         COALESCE(SUM(CASE WHEN t.type='income' AND c.code='IURAN_KONSUMSI_ANGGOTA' THEN t.amount ELSE 0 END), 0) AS in_iuran_konsumsi_anggota,
         COALESCE(SUM(CASE WHEN t.type='expense' AND t.source_fund='iuran_konsumsi_anggota' THEN t.amount ELSE 0 END), 0) AS out_iuran_konsumsi_anggota,
         COALESCE(SUM(CASE WHEN t.type='income' AND c.code='IURAN_PENGURUS' THEN t.amount ELSE 0 END), 0) AS in_iuran_pengurus,
         COALESCE(SUM(CASE WHEN t.type='expense' AND (t.source_fund='iuran_pengurus' OR c.code='ARISAN_PENGURUS') THEN t.amount ELSE 0 END), 0) AS out_iuran_pengurus
       FROM cash_transactions t
       INNER JOIN cash_categories c ON c.id = t.category_id
       WHERE t.status='approved' AND t.transaction_date BETWEEN ? AND ?
       GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m')
       ORDER BY ym ASC`,
      [fromDate, toDate]
    ).then(([rows]) => rows),
    pool.execute<TransactionRow[]>(
      `SELECT
         t.id, t.transaction_number, t.transaction_date, t.type, t.amount, t.description,
         t.source_fund, c.name AS category_name, c.code AS category_code,
         CASE
           WHEN t.type='income' AND c.code='IURAN_ANGGOTA' THEN 'iuran_anggota'
           WHEN t.type='income' AND c.code='IURAN_KONSUMSI_ANGGOTA' THEN 'iuran_konsumsi_anggota'
           WHEN t.type='income' AND c.code='IURAN_PENGURUS' THEN 'iuran_pengurus'
           WHEN t.type='expense' AND (t.source_fund='iuran_anggota' OR c.code='ARISAN_ANGGOTA') THEN 'iuran_anggota'
           WHEN t.type='expense' AND t.source_fund='iuran_konsumsi_anggota' THEN 'iuran_konsumsi_anggota'
           WHEN t.type='expense' AND (t.source_fund='iuran_pengurus' OR c.code='ARISAN_PENGURUS') THEN 'iuran_pengurus'
         END AS dana_code
       FROM cash_transactions t
       INNER JOIN cash_categories c ON c.id = t.category_id
       WHERE t.status='approved'
         AND t.transaction_date BETWEEN ? AND ?
         AND (
           (t.type='income' AND c.code IN ('IURAN_ANGGOTA','IURAN_KONSUMSI_ANGGOTA','IURAN_PENGURUS'))
           OR (t.type='expense' AND (t.source_fund IN ('iuran_anggota','iuran_konsumsi_anggota','iuran_pengurus') OR c.code IN ('ARISAN_ANGGOTA','ARISAN_PENGURUS')))
         )
       ORDER BY t.transaction_date ASC, t.id ASC`,
      [fromDate, toDate]
    ).then(([rows]) => rows),
  ]);

  const monthlyByYm = new Map(monthlyRows.map((row) => [String(row.ym), aggregateFromRow(row)]));
  const running: Record<RekapIuranFundCode, number> = {
    iuran_anggota: saldoAwalAggregate.iuran_anggota.pemasukan - saldoAwalAggregate.iuran_anggota.pengeluaran,
    iuran_konsumsi_anggota: saldoAwalAggregate.iuran_konsumsi_anggota.pemasukan - saldoAwalAggregate.iuran_konsumsi_anggota.pengeluaran,
    iuran_pengurus: saldoAwalAggregate.iuran_pengurus.pemasukan - saldoAwalAggregate.iuran_pengurus.pengeluaran,
  };
  const totalPemasukan: Record<RekapIuranFundCode, number> = {
    iuran_anggota: 0,
    iuran_konsumsi_anggota: 0,
    iuran_pengurus: 0,
  };
  const totalPengeluaran: Record<RekapIuranFundCode, number> = {
    iuran_anggota: 0,
    iuran_konsumsi_anggota: 0,
    iuran_pengurus: 0,
  };

  const monthly: RekapIuranMonthlyRow[] = [];
  let cursor = { ...awal };
  while (`${cursor.tahun}-${pad2(cursor.bulan)}-01` <= toDate) {
    const ym = `${cursor.tahun}-${pad2(cursor.bulan)}`;
    const aggregate = monthlyByYm.get(ym);
    const funds = REKAP_IURAN_FUND_DEFS.map((fund) => {
      const saldo_awal = running[fund.code];
      const total_pemasukan = aggregate?.[fund.code].pemasukan ?? 0;
      const total_pengeluaran = aggregate?.[fund.code].pengeluaran ?? 0;
      const saldo_akhir = saldo_awal + total_pemasukan - total_pengeluaran;

      running[fund.code] = saldo_akhir;
      totalPemasukan[fund.code] += total_pemasukan;
      totalPengeluaran[fund.code] += total_pengeluaran;

      return {
        code: fund.code,
        name: fund.name,
        saldo_awal,
        total_pemasukan,
        total_pengeluaran,
        saldo_akhir,
      };
    });

    monthly.push({
      ym,
      label: monthLabel(cursor.tahun, cursor.bulan),
      funds,
      total_pemasukan: funds.reduce((sum, fund) => sum + fund.total_pemasukan, 0),
      total_pengeluaran: funds.reduce((sum, fund) => sum + fund.total_pengeluaran, 0),
      saldo_akhir: funds.reduce((sum, fund) => sum + fund.saldo_akhir, 0),
    });

    cursor = addMonth(cursor.tahun, cursor.bulan);
  }

  const summary = REKAP_IURAN_FUND_DEFS.map((fund) => {
    const saldo_awal = saldoAwalAggregate[fund.code].pemasukan - saldoAwalAggregate[fund.code].pengeluaran;
    const total_pemasukan = totalPemasukan[fund.code];
    const total_pengeluaran = totalPengeluaran[fund.code];

    return {
      code: fund.code,
      name: fund.name,
      saldo_awal,
      total_pemasukan,
      total_pengeluaran,
      saldo_akhir: saldo_awal + total_pemasukan - total_pengeluaran,
    };
  });

  return {
    periode: {
      bulan_awal: awal.bulan,
      tahun_awal: awal.tahun,
      bulan_akhir: akhir.bulan,
      tahun_akhir: akhir.tahun,
      awal: fromDate,
      akhir: toDate,
      label_awal: monthLabel(awal.tahun, awal.bulan),
      label_akhir: monthLabel(akhir.tahun, akhir.bulan),
      label: `${monthLabel(awal.tahun, awal.bulan)} - ${monthLabel(akhir.tahun, akhir.bulan)}`,
      tanggal_serah_terima: serahTerimaDate,
    },
    summary,
    total: {
      saldo_awal: summary.reduce((sum, fund) => sum + fund.saldo_awal, 0),
      total_pemasukan: summary.reduce((sum, fund) => sum + fund.total_pemasukan, 0),
      total_pengeluaran: summary.reduce((sum, fund) => sum + fund.total_pengeluaran, 0),
      saldo_akhir: summary.reduce((sum, fund) => sum + fund.saldo_akhir, 0),
    },
    monthly,
    transaksi: transactionRows.map((row) => ({
      id: Number(row.id),
      transaction_number: row.transaction_number,
      transaction_date: row.transaction_date,
      type: row.type,
      amount: Number(row.amount),
      description: row.description,
      category_name: row.category_name,
      category_code: row.category_code,
      source_fund: row.source_fund,
      source_fund_label: row.type === "expense" ? getSourceFundLabel(row.source_fund) : "-",
      dana_code: row.dana_code,
      dana_name: REKAP_IURAN_FUND_DEFS.find((fund) => fund.code === row.dana_code)?.name ?? row.dana_code,
    })),
  };
}
