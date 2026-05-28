import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";

export interface AnggotaRow extends RowDataPacket {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: "Aktif" | "Non-Aktif" | "Cuti";
  no_hp: string | null;
  email: string | null;
  alamat: string | null;
  join_date: string;
  created_at: string;
  updated_at: string;
}

function applyJenisFilter(jenis: string, conditions: string[]) {
  const normalizedJenis = jenis.trim().toLowerCase();

  // Di data anggota, kolom yang merepresentasikan "jenis" adalah jabatan:
  // - Anggota  => jabatan persis "Anggota"
  // - Pengurus => semua jabatan selain "Anggota" (Ketua, Sekretaris, Bendahara, dst.)
  if (normalizedJenis === "pengurus") {
    conditions.push("LOWER(TRIM(COALESCE(jabatan, ''))) <> 'anggota'");
  } else if (normalizedJenis === "anggota") {
    conditions.push("LOWER(TRIM(COALESCE(jabatan, ''))) = 'anggota'");
  }
}

// GET /api/anggota?search=&status=&unit=&jenis=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "";
    const unit = searchParams.get("unit") ?? "";
    const jenis = searchParams.get("jenis") ?? "";
    const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, parsedLimit) : 10;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push("(nama LIKE ? OR nip LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    if (unit) {
      conditions.push("unit_kerja = ?");
      params.push(unit);
    }
    applyJenisFilter(jenis, conditions);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await pool.execute<AnggotaRow[]>(
      `SELECT * FROM anggota ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
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
    const { response } = await requireAdmin(req);
    if (response) return response;
    const body = await req.json();
    const { nama, nip, jabatan, unit_kerja, status, no_hp, email, alamat, join_date, tanggal_keluar } = body;

    if (!nama || !nip || !jabatan || !unit_kerja) {
      return NextResponse.json({ error: "Field wajib tidak lengkap" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO anggota (nama, nip, jabatan, unit_kerja, status, no_hp, email, alamat, join_date, tanggal_keluar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nama,
        nip,
        jabatan,
        unit_kerja,
        status ?? "Aktif",
        no_hp ?? null,
        email ?? null,
        alamat ?? null,
        join_date ?? new Date().toISOString().split("T")[0],
        tanggal_keluar ? String(tanggal_keluar).slice(0, 10) : null,
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
