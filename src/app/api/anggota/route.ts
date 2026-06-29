import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";
import {
  buildAnggotaWhereClause,
  buildEffectiveStatusSql,
  ensureAnggotaSchema,
  STATUS_KEANGGOTAAN_OPTIONS,
  type StatusKeanggotaan,
} from "@/lib/anggota";

export interface AnggotaRow extends RowDataPacket {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: "Aktif" | "Non-Aktif" | "Cuti";
  status_keanggotaan: StatusKeanggotaan;
  no_hp: string | null;
  email: string | null;
  alamat: string | null;
  tanggal_lahir: string | null;
  join_date: string;
  tanggal_keluar: string | null;
  tanggal_pensiun: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/anggota?search=&status=&unit=&jenis=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    await ensureAnggotaSchema();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "";
    const statusKeanggotaan = searchParams.get("statusKeanggotaan") ?? "";
    const unit = searchParams.get("unit") ?? "";
    const jenis = searchParams.get("jenis") ?? "";
    const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, parsedLimit) : 10;
    const offset = (page - 1) * limit;

    const { where, params } = buildAnggotaWhereClause({ search, status, statusKeanggotaan, unit, jenis });
    const effectiveStatusSql = buildEffectiveStatusSql();

    const [rows] = await pool.execute<AnggotaRow[]>(
      `SELECT id, nama, nip, jabatan, unit_kerja,
              ${effectiveStatusSql} AS status,
              status_keanggotaan, no_hp, email, alamat, tanggal_lahir, join_date, tanggal_keluar, tanggal_pensiun,
              created_at, updated_at
       FROM anggota ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [[{ total }]] = await pool.execute<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) as total FROM anggota ${where}`,
      params
    );

    return NextResponse.json({ data: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

// POST /api/anggota
export async function POST(req: NextRequest) {
  try {
    await ensureAnggotaSchema();

    const { response } = await requireAdmin(req);
    if (response) return response;
    const body = await req.json();
    const { nama, nip, jabatan, unit_kerja, status, status_keanggotaan, no_hp, email, alamat, tanggal_lahir, join_date, tanggal_keluar, tanggal_pensiun } = body;
    const normalizedTanggalKeluar = tanggal_keluar ? String(tanggal_keluar).slice(0, 10) : null;
    const normalizedTanggalLahir = tanggal_lahir ? String(tanggal_lahir).slice(0, 10) : null;
    const normalizedStatus = normalizedTanggalKeluar ? "Non-Aktif" : (status ?? "Aktif");
    const normalizedStatusKeanggotaan = STATUS_KEANGGOTAAN_OPTIONS.includes(status_keanggotaan)
      ? status_keanggotaan
      : STATUS_KEANGGOTAAN_OPTIONS[0];

    if (!nama || !nip || !jabatan || !unit_kerja) {
      return NextResponse.json({ error: "Field wajib tidak lengkap" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO anggota (nama, nip, jabatan, unit_kerja, status, status_keanggotaan, no_hp, email, alamat, tanggal_lahir, join_date, tanggal_keluar, tanggal_pensiun)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nama,
        nip,
        jabatan,
        unit_kerja,
        normalizedStatus,
        normalizedStatusKeanggotaan,
        no_hp ?? null,
        email ?? null,
        alamat ?? null,
        normalizedTanggalLahir,
        join_date ?? new Date().toISOString().split("T")[0],
        normalizedTanggalKeluar,
        tanggal_pensiun ? String(tanggal_pensiun).slice(0, 10) : null,
      ]
    );

    return NextResponse.json({ id: result.insertId, message: "Anggota berhasil ditambahkan" }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "NIP sudah terdaftar" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menambah data" }, { status: 500 });
  }
}
