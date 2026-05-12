import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureIuranTarifSchema } from "@/lib/iuran";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface TarifRow extends RowDataPacket {
  id: number;
  nominal_anggota: string;
  nominal_konsumsi_anggota: string;
  nominal_pengurus: string;
  periode_mulai: string;
  aktif: number;
  catatan: string | null;
}

// GET /api/iuran/tarif — list semua tarif (terbaru duluan)
export async function GET() {
  try {
    await ensureIuranTarifSchema();

    const [rows] = await pool.execute<TarifRow[]>(
      `SELECT id, nominal_anggota, nominal_konsumsi_anggota, nominal_pengurus, periode_mulai, aktif, catatan, created_at, updated_at
       FROM iuran_tarif
       ORDER BY periode_mulai DESC, id DESC`
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil tarif" }, { status: 500 });
  }
}

// POST /api/iuran/tarif — tambah tarif baru
export async function POST(req: NextRequest) {
  try {
    await ensureIuranTarifSchema();

    const body = await req.json();
    const nominal_anggota = Number(body.nominal_anggota);
    const nominal_konsumsi_anggota = Number(body.nominal_konsumsi_anggota ?? 0);
    const nominal_pengurus = Number(body.nominal_pengurus);
    const periode_mulai = String(body.periode_mulai ?? "").slice(0, 10);
    const aktif = body.aktif === false || body.aktif === 0 ? 0 : 1;
    const catatan = body.catatan ? String(body.catatan).slice(0, 255) : null;

    if (!Number.isFinite(nominal_anggota) || nominal_anggota < 0) {
      return NextResponse.json({ error: "Nominal iuran arisan anggota tidak valid" }, { status: 400 });
    }
    if (!Number.isFinite(nominal_konsumsi_anggota) || nominal_konsumsi_anggota < 0) {
      return NextResponse.json({ error: "Nominal iuran konsumsi anggota tidak valid" }, { status: 400 });
    }
    if (!Number.isFinite(nominal_pengurus) || nominal_pengurus < 0) {
      return NextResponse.json({ error: "Nominal iuran pengurus tidak valid" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periode_mulai)) {
      return NextResponse.json({ error: "Periode mulai tidak valid (YYYY-MM-DD)" }, { status: 400 });
    }

    // Normalisasi ke tanggal 1 bulan tsb
    const normalized = `${periode_mulai.slice(0, 7)}-01`;

    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO iuran_tarif (nominal_anggota, nominal_konsumsi_anggota, nominal_pengurus, periode_mulai, aktif, catatan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nominal_anggota, nominal_konsumsi_anggota, nominal_pengurus, normalized, aktif, catatan]
    );
    return NextResponse.json({ id: res.insertId, message: "Tarif tersimpan" }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Sudah ada tarif untuk periode tersebut" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan tarif" }, { status: 500 });
  }
}
