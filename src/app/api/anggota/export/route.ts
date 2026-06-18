import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { buildAnggotaWhereClause, ensureAnggotaTanggalPensiunColumn } from "@/lib/anggota";

interface AnggotaExportRow extends RowDataPacket {
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: string;
  no_hp: string | null;
  email: string | null;
  alamat: string | null;
  join_date: string;
  tanggal_keluar: string | null;
  tanggal_pensiun: string | null;
}

function csvCell(value: string | number | null | undefined) {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function formatDate(value: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

// GET /api/anggota/export?search=&status=&unit=&jenis=
export async function GET(req: NextRequest) {
  try {
    await ensureAnggotaTanggalPensiunColumn();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "";
    const unit = searchParams.get("unit") ?? "";
    const jenis = searchParams.get("jenis") ?? "";

    const { where, params } = buildAnggotaWhereClause({ search, status, unit, jenis });

    const [rows] = await pool.execute<AnggotaExportRow[]>(
      `SELECT nama, nip, jabatan, unit_kerja, status, no_hp, email, alamat, join_date, tanggal_keluar, tanggal_pensiun
       FROM anggota ${where}
       ORDER BY created_at DESC`,
      params
    );

    const header = [
      "No",
      "Nama",
      "NIP",
      "Jabatan",
      "Unit Kerja",
      "Status",
      "No HP",
      "Email",
      "Alamat",
      "Tanggal Gabung",
      "Tanggal Keluar",
      "Tanggal Pensiun",
    ];

    const lines = [header.join(",")];
    rows.forEach((row, index) => {
      lines.push(
        [
          index + 1,
          csvCell(row.nama),
          csvCell(row.nip),
          csvCell(row.jabatan),
          csvCell(row.unit_kerja),
          csvCell(row.status),
          csvCell(row.no_hp),
          csvCell(row.email),
          csvCell(row.alamat),
          csvCell(formatDate(row.join_date)),
          csvCell(formatDate(row.tanggal_keluar)),
          csvCell(formatDate(row.tanggal_pensiun)),
        ].join(",")
      );
    });

    const csv = `\uFEFF${lines.join("\n")}`;
    const filename = `anggota-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal mengekspor data anggota" }, { status: 500 });
  }
}