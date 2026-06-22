import pool from "./db";
import type { RowDataPacket } from "mysql2";

const SALDO_AWAL_ARISAN_ANGGOTA_MEI_2026_KEY = "saldo_awal_arisan_anggota_mei_2026";

export interface LaporanRow {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: string;
  join_date: string;
  tanggal_keluar: string | null;
  is_pengurus: boolean;
  iuran_anggota: number;
  iuran_konsumsi_anggota: number;
  iuran_pengurus: number;
  total: number;
  keterangan: string;
}

export interface LaporanFilters {
  bulan: number;          // 1..12
  tahun: number;
  unit?: string;
  pengurus?: "all" | "pengurus" | "anggota";
  status?: string;        // Aktif | Cuti | Non-Aktif | ""
}

export interface LaporanResult {
  periode: { bulan: number; tahun: number; awal: string; akhir: string; label: string };
  tarif: { nominal_anggota: number; nominal_konsumsi_anggota: number; nominal_pengurus: number; periode_mulai: string | null } | null;
  rows: LaporanRow[];
  saldo_iuran_arisan: {
    saldo_awal: number;
    iuran_bulan_ini: number;
    saldo_akhir: number;
  };
  summary: {
    total_anggota_aktif: number;
    total_pengurus_aktif: number;
    total_iuran_anggota: number;
    total_iuran_konsumsi_anggota: number;
    total_iuran_pengurus: number;
    grand_total: number;
  };
}

type LaporanBaseResult = Omit<LaporanResult, "saldo_iuran_arisan">;

const BULAN_LABELS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

let iuranTarifSchemaReady: Promise<void> | null = null;

export function ensureIuranTarifSchema(): Promise<void> {
  iuranTarifSchemaReady ??= (async () => {
    const [columns] = await pool.execute<RowDataPacket[]>(
      `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'iuran_tarif'
          AND COLUMN_NAME = 'nominal_konsumsi_anggota'
        LIMIT 1`
    );

    if (columns.length === 0) {
      await pool.execute(`
        ALTER TABLE iuran_tarif
        ADD COLUMN nominal_konsumsi_anggota DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER nominal_anggota
      `);
    }
  })();

  return iuranTarifSchemaReady;
}

async function buildLaporanIuranBase(filter: LaporanFilters): Promise<LaporanBaseResult> {
  await ensureIuranTarifSchema();

  const bulan = Math.max(1, Math.min(12, Math.trunc(filter.bulan)));
  const tahun = Math.trunc(filter.tahun);
  const periodStart = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const lastDay = new Date(tahun, bulan, 0).getDate();
  const periodEnd = `${tahun}-${String(bulan).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Tarif yang berlaku: periode_mulai <= akhir bulan, aktif=1, ambil yang terbaru
  const [tarifRows] = await pool.execute<RowDataPacket[]>(
    `SELECT nominal_anggota, nominal_konsumsi_anggota, nominal_pengurus, periode_mulai
     FROM iuran_tarif
     WHERE aktif = 1 AND periode_mulai <= ?
     ORDER BY periode_mulai DESC
     LIMIT 1`,
    [periodEnd]
  );
  const tarif = tarifRows[0]
    ? {
        nominal_anggota: Number(tarifRows[0].nominal_anggota),
        nominal_konsumsi_anggota: Number(tarifRows[0].nominal_konsumsi_anggota ?? 0),
        nominal_pengurus: Number(tarifRows[0].nominal_pengurus),
        periode_mulai: String(tarifRows[0].periode_mulai),
      }
    : null;

  // Filter SQL
  const where: string[] = [
    "join_date <= ?",
    "(tanggal_keluar IS NULL OR tanggal_keluar >= ?)",
    // Anggota Non-Aktif tanpa tanggal_keluar dianggap keluar dari semua periode
    "(status <> 'Non-Aktif' OR tanggal_keluar IS NOT NULL)",
  ];
  const params: (string | number)[] = [periodEnd, periodStart];

  if (filter.unit) {
    where.push("unit_kerja = ?");
    params.push(filter.unit);
  }
  if (filter.status) {
    where.push("status = ?");
    params.push(filter.status);
  }
  if (filter.pengurus === "pengurus") {
    where.push("jabatan <> 'Anggota'");
  } else if (filter.pengurus === "anggota") {
    where.push("jabatan = 'Anggota'");
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nama, nip, jabatan, unit_kerja, status, join_date, tanggal_keluar
     FROM anggota
     WHERE ${where.join(" AND ")}
     ORDER BY unit_kerja ASC, nama ASC`,
    params
  );

  const nominalAnggota = tarif?.nominal_anggota ?? 0;
  const nominalKonsumsiAnggota = tarif?.nominal_konsumsi_anggota ?? 0;
  const nominalPengurus = tarif?.nominal_pengurus ?? 0;

  let totalAnggotaAktif = 0;
  let totalPengurusAktif = 0;
  let totalIuranAnggota = 0;
  let totalIuranKonsumsiAnggota = 0;
  let totalIuranPengurus = 0;

  const result: LaporanRow[] = rows.map((r) => {
    const isPengurus = r.jabatan !== "Anggota";
    const iuranAnggota = nominalAnggota;
    const iuranKonsumsiAnggota = nominalKonsumsiAnggota;
    const iuranPengurus = isPengurus ? nominalPengurus : 0;
    const total = iuranAnggota + iuranKonsumsiAnggota + iuranPengurus;
    const keluarBulanIni =
      r.tanggal_keluar &&
      String(r.tanggal_keluar) >= periodStart &&
      String(r.tanggal_keluar) <= periodEnd;
    const keterangan = keluarBulanIni
      ? `Keluar ${String(r.tanggal_keluar).slice(0, 10)}`
      : r.status;

    totalAnggotaAktif += 1;
    if (isPengurus) totalPengurusAktif += 1;
    totalIuranAnggota += iuranAnggota;
    totalIuranKonsumsiAnggota += iuranKonsumsiAnggota;
    totalIuranPengurus += iuranPengurus;

    return {
      id: Number(r.id),
      nama: String(r.nama),
      nip: String(r.nip),
      jabatan: String(r.jabatan),
      unit_kerja: String(r.unit_kerja),
      status: String(r.status),
      join_date: String(r.join_date),
      tanggal_keluar: r.tanggal_keluar ? String(r.tanggal_keluar) : null,
      is_pengurus: isPengurus,
      iuran_anggota: iuranAnggota,
      iuran_konsumsi_anggota: iuranKonsumsiAnggota,
      iuran_pengurus: iuranPengurus,
      total,
      keterangan,
    };
  });

  return {
    periode: {
      bulan,
      tahun,
      awal: periodStart,
      akhir: periodEnd,
      label: `${BULAN_LABELS[bulan - 1]} ${tahun}`,
    },
    tarif,
    rows: result,
    summary: {
      total_anggota_aktif: totalAnggotaAktif,
      total_pengurus_aktif: totalPengurusAktif,
      total_iuran_anggota: totalIuranAnggota,
      total_iuran_konsumsi_anggota: totalIuranKonsumsiAnggota,
      total_iuran_pengurus: totalIuranPengurus,
      grand_total: totalIuranAnggota + totalIuranKonsumsiAnggota + totalIuranPengurus,
    },
  };
}

async function getTotalIuranArisanAnggotaGlobal(bulan: number, tahun: number): Promise<number> {
  const laporan = await buildLaporanIuranBase({ bulan, tahun });
  return laporan.summary.total_iuran_anggota;
}

async function getSaldoAwalArisanAnggotaMei2026(): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT value FROM app_settings WHERE key_name = ? LIMIT 1`,
    [SALDO_AWAL_ARISAN_ANGGOTA_MEI_2026_KEY]
  );

  const rawValue = rows[0]?.value;
  const parsed = Number(rawValue ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getSaldoIuranArisanSebelumnya(bulan: number, tahun: number): Promise<number> {
  if (tahun === 2026 && bulan >= 5) {
    let saldo = await getSaldoAwalArisanAnggotaMei2026();

    for (let month = 5; month < bulan; month += 1) {
      saldo += await getTotalIuranArisanAnggotaGlobal(month, tahun);
    }

    return saldo;
  }

  let saldo = 0;

  for (let month = 1; month < bulan; month += 1) {
    saldo += await getTotalIuranArisanAnggotaGlobal(month, tahun);
  }

  return saldo;
}

export async function getLaporanIuran(filter: LaporanFilters): Promise<LaporanResult> {
  const base = await buildLaporanIuranBase(filter);
  const saldoAwalIuranArisan = await getSaldoIuranArisanSebelumnya(base.periode.bulan, base.periode.tahun);
  const iuranBulanIni = await getTotalIuranArisanAnggotaGlobal(base.periode.bulan, base.periode.tahun);

  return {
    ...base,
    saldo_iuran_arisan: {
      saldo_awal: saldoAwalIuranArisan,
      iuran_bulan_ini: iuranBulanIni,
      saldo_akhir: saldoAwalIuranArisan + iuranBulanIni,
    },
  };
}
