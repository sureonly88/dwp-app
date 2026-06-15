import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader } from "mysql2";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/admin-auth";
import { ensureAnggotaTanggalPensiunColumn } from "@/lib/anggota";

type AnggotaStatus = "Aktif" | "Non-Aktif" | "Cuti";

interface ImportRow {
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: AnggotaStatus;
  no_hp: string | null;
  email: string | null;
  alamat: string | null;
  join_date: string;
  tanggal_keluar: string | null;
  tanggal_pensiun: string | null;
}

interface ImportErrorItem {
  row: number;
  message: string;
}

const REQUIRED_COLUMNS = ["nama", "nip", "jabatan", "unit_kerja"];
const ALLOWED_STATUSES: AnggotaStatus[] = ["Aktif", "Non-Aktif", "Cuti"];

const COLUMN_ALIASES: Record<string, keyof ImportRow> = {
  nama: "nama",
  "nama anggota": "nama",
  "nama lengkap": "nama",
  nip: "nip",
  "nip/id": "nip",
  id: "nip",
  jabatan: "jabatan",
  unit: "unit_kerja",
  "unit kerja": "unit_kerja",
  unit_kerja: "unit_kerja",
  status: "status",
  "no hp": "no_hp",
  "no. hp": "no_hp",
  no_hp: "no_hp",
  hp: "no_hp",
  telepon: "no_hp",
  email: "email",
  alamat: "alamat",
  "tanggal bergabung": "join_date",
  join_date: "join_date",
  "join date": "join_date",
  "tanggal keluar": "tanggal_keluar",
  tanggal_keluar: "tanggal_keluar",
  "tanggal pensiun": "tanggal_pensiun",
  tanggal_pensiun: "tanggal_pensiun",
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cellToString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }

  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  const idMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (idMatch) {
    return `${idMatch[3]}-${idMatch[2].padStart(2, "0")}-${idMatch[1].padStart(2, "0")}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(value: unknown): AnggotaStatus | null {
  const raw = cellToString(value).toLowerCase();
  if (!raw) return "Aktif";
  if (["aktif", "active"].includes(raw)) return "Aktif";
  if (["non-aktif", "non aktif", "nonaktif", "inactive", "tidak aktif"].includes(raw)) return "Non-Aktif";
  if (raw === "cuti") return "Cuti";
  return null;
}

function isBlankRow(row: unknown[]) {
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === "");
}

export async function POST(req: NextRequest) {
  try {
    await ensureAnggotaTanggalPensiunColumn();

    const { response } = await requireAdmin(req);
    if (response) return response;
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File Excel wajib diunggah" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      return NextResponse.json({ error: "Format file harus .xlsx atau .xls" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = sheetName ? workbook.Sheets[sheetName] : null;

    if (!worksheet) {
      return NextResponse.json({ error: "Sheet Excel tidak ditemukan" }, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
    const headerIndex = rows.findIndex((row) => Array.isArray(row) && !isBlankRow(row));
    if (headerIndex < 0) {
      return NextResponse.json({ error: "File Excel kosong" }, { status: 400 });
    }

    const headers = rows[headerIndex].map((h) => COLUMN_ALIASES[normalizeHeader(h)] ?? null);
    const availableColumns = new Set(headers.filter(Boolean));
    const missingColumns = REQUIRED_COLUMNS.filter((col) => !availableColumns.has(col as keyof ImportRow));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `Kolom wajib belum lengkap: ${missingColumns.join(", ")}` },
        { status: 400 }
      );
    }

    const validRows: ImportRow[] = [];
    const errors: ImportErrorItem[] = [];
    const seenNip = new Set<string>();

    rows.slice(headerIndex + 1).forEach((rawRow, index) => {
      const excelRowNumber = headerIndex + index + 2;
      if (!Array.isArray(rawRow) || isBlankRow(rawRow)) return;

      const record: Partial<Record<keyof ImportRow, unknown>> = {};
      rawRow.forEach((cell, cellIndex) => {
        const key = headers[cellIndex];
        if (key) record[key] = cell;
      });

      const nama = cellToString(record.nama);
      const nip = cellToString(record.nip);
      const jabatan = cellToString(record.jabatan);
      const unitKerja = cellToString(record.unit_kerja);
      const status = normalizeStatus(record.status);
      const joinDate = normalizeDate(record.join_date) ?? new Date().toISOString().slice(0, 10);
      const tanggalKeluar = normalizeDate(record.tanggal_keluar);
      const tanggalPensiun = normalizeDate(record.tanggal_pensiun);

      if (!nama || !nip || !jabatan || !unitKerja) {
        errors.push({ row: excelRowNumber, message: "Nama, NIP, jabatan, dan unit_kerja wajib diisi" });
        return;
      }
      if (nip.length > 20) {
        errors.push({ row: excelRowNumber, message: "NIP maksimal 20 karakter" });
        return;
      }
      if (seenNip.has(nip)) {
        errors.push({ row: excelRowNumber, message: `NIP ${nip} duplikat di file import` });
        return;
      }
      if (!status || !ALLOWED_STATUSES.includes(status)) {
        errors.push({ row: excelRowNumber, message: "Status harus Aktif, Non-Aktif, atau Cuti" });
        return;
      }

      seenNip.add(nip);
      validRows.push({
        nama,
        nip,
        jabatan,
        unit_kerja: unitKerja,
        status,
        no_hp: cellToString(record.no_hp) || null,
        email: cellToString(record.email) || null,
        alamat: cellToString(record.alamat) || null,
        join_date: joinDate,
        tanggal_keluar: tanggalKeluar,
        tanggal_pensiun: tanggalPensiun,
      });
    });

    if (validRows.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris valid untuk diimport", errors }, { status: 400 });
    }

    let inserted = 0;
    let updated = 0;

    for (const row of validRows) {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO anggota (nama, nip, jabatan, unit_kerja, status, no_hp, email, alamat, join_date, tanggal_keluar, tanggal_pensiun)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           nama = VALUES(nama),
           jabatan = VALUES(jabatan),
           unit_kerja = VALUES(unit_kerja),
           status = VALUES(status),
           no_hp = VALUES(no_hp),
           email = VALUES(email),
           alamat = VALUES(alamat),
           join_date = VALUES(join_date),
           tanggal_keluar = VALUES(tanggal_keluar),
           tanggal_pensiun = VALUES(tanggal_pensiun)`,
        [
          row.nama,
          row.nip,
          row.jabatan,
          row.unit_kerja,
          row.status,
          row.no_hp,
          row.email,
          row.alamat,
          row.join_date,
          row.tanggal_keluar,
          row.tanggal_pensiun,
        ]
      );

      if (result.affectedRows === 1) inserted += 1;
      if (result.affectedRows === 2) updated += 1;
    }

    return NextResponse.json({
      message: "Import data anggota selesai",
      inserted,
      updated,
      skipped: errors.length,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengimport data anggota" }, { status: 500 });
  }
}
