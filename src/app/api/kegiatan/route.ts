import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { randomBytes } from "crypto";
import { computeKegiatanStatus } from "@/lib/kegiatanUtils";

export interface KegiatanRow extends RowDataPacket {
  id: number;
  judul: string;
  deskripsi: string | null;
  tanggal: string;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  lokasi: string | null;
  kategori: string;
  status: "Mendatang" | "Berlangsung" | "Selesai" | "Dibatalkan";
  event_code: string;
  target_peserta: number | null;
  created_at: string;
  updated_at: string;
  hadir_count?: number;
}

function generateEventCode() {
  // 8-char URL-safe code
  return randomBytes(6).toString("base64url").slice(0, 8).toUpperCase();
}

// GET /api/kegiatan?search=&status=&kategori=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "";
    const kategori = searchParams.get("kategori") ?? "";
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(500, parsedLimit) : 10;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push("(k.judul LIKE ? OR k.lokasi LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      conditions.push("k.status = ?");
      params.push(status);
    }
    if (kategori) {
      conditions.push("k.kategori = ?");
      params.push(kategori);
    }
    if (from) {
      conditions.push("k.tanggal >= ?");
      params.push(from);
    }
    if (to) {
      conditions.push("k.tanggal <= ?");
      params.push(to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await pool.execute<KegiatanRow[]>(
      `SELECT k.*,
              COUNT(DISTINCT p.id)  AS hadir_count,
              COUNT(DISTINCT pt.id) AS tamu_count
       FROM kegiatan k
       LEFT JOIN presensi p      ON p.kegiatan_id  = k.id
       LEFT JOIN presensi_tamu pt ON pt.kegiatan_id = k.id
       ${where}
       GROUP BY k.id
       ORDER BY k.tanggal DESC, k.waktu_mulai DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [[{ total }]] = await pool.execute<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) as total FROM kegiatan k ${where}`,
      params
    );

    return NextResponse.json({
      data: rows.map((r) => ({
        ...r,
        status: computeKegiatanStatus(r.tanggal, r.waktu_mulai, r.waktu_selesai, r.status),
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

// POST /api/kegiatan
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      judul,
      deskripsi,
      tanggal,
      waktu_mulai,
      waktu_selesai,
      lokasi,
      kategori,
      status,
      target_peserta,
      unit_kerja_bertugas,
    } = body;

    if (!judul || !tanggal) {
      return NextResponse.json({ error: "Judul dan tanggal wajib diisi" }, { status: 400 });
    }

    // Generate unique event code (retry up to 5x on collision)
    let eventCode = generateEventCode();
    for (let i = 0; i < 5; i++) {
      const [exists] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM kegiatan WHERE event_code = ? LIMIT 1",
        [eventCode]
      );
      if (exists.length === 0) break;
      eventCode = generateEventCode();
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO kegiatan
        (judul, deskripsi, tanggal, waktu_mulai, waktu_selesai, lokasi, kategori, status, event_code, target_peserta, unit_kerja_bertugas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        judul,
        deskripsi ?? null,
        tanggal,
        waktu_mulai || null,
        waktu_selesai || null,
        lokasi ?? null,
        kategori ?? "Rapat",
        computeKegiatanStatus(tanggal, waktu_mulai || null, waktu_selesai || null, status ?? "Mendatang"),
        eventCode,
        target_peserta ?? null,
        unit_kerja_bertugas ?? null,
      ]
    );

    return NextResponse.json(
      { id: result.insertId, event_code: eventCode, message: "Kegiatan berhasil dibuat" },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menambah kegiatan" }, { status: 500 });
  }
}
