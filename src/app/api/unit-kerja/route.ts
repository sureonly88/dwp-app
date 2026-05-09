import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query(
      "SELECT id, kode, nama, deskripsi, aktif FROM unit_kerja ORDER BY nama ASC"
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/unit-kerja error:", err);
    return NextResponse.json({ error: "Gagal mengambil data unit kerja" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kode, nama, deskripsi } = body;

    if (!kode?.trim() || !nama?.trim()) {
      return NextResponse.json({ error: "Kode dan Nama wajib diisi" }, { status: 400 });
    }

    const kodeUpper = String(kode).trim().toUpperCase().replace(/\s+/g, "_");

    const [result] = await pool.query(
      "INSERT INTO unit_kerja (kode, nama, deskripsi) VALUES (?, ?, ?)",
      [kodeUpper, nama.trim(), deskripsi?.trim() ?? null]
    ) as [{ insertId: number }, unknown];

    const [rows] = await pool.query("SELECT * FROM unit_kerja WHERE id = ?", [result.insertId]);
    const newRow = (rows as unknown[])[0];
    return NextResponse.json(newRow, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/unit-kerja error:", err);
    const mysqlErr = err as { code?: string };
    if (mysqlErr.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Kode Unit Kerja sudah digunakan" }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal menyimpan data" }, { status: 500 });
  }
}
