import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";
import { buildEffectiveStatusSql, ensureAnggotaSchema, STATUS_KEANGGOTAAN_OPTIONS } from "@/lib/anggota";

// GET /api/anggota/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAnggotaSchema();

    const { id } = await params;
    const effectiveStatusSql = buildEffectiveStatusSql();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, nama, nip, jabatan, unit_kerja,
              ${effectiveStatusSql} AS status,
              status_keanggotaan, no_hp, email, alamat, tanggal_lahir, join_date, tanggal_keluar, tanggal_pensiun,
              created_at, updated_at
       FROM anggota WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

// PUT /api/anggota/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAnggotaSchema();

    const { response } = await requireAdmin(req);
    if (response) return response;
    const { id } = await params;
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
      `UPDATE anggota SET nama=?, nip=?, jabatan=?, unit_kerja=?, status=?, status_keanggotaan=?, no_hp=?, email=?, alamat=?, tanggal_lahir=?, join_date=?, tanggal_keluar=?, tanggal_pensiun=?
       WHERE id=?`,
      [nama, nip, jabatan, unit_kerja, normalizedStatus, normalizedStatusKeanggotaan, no_hp ?? null, email ?? null, alamat ?? null, normalizedTanggalLahir, join_date, normalizedTanggalKeluar, tanggal_pensiun ? String(tanggal_pensiun).slice(0, 10) : null, id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Data berhasil diperbarui" });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "NIP sudah terdaftar" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal memperbarui data" }, { status: 500 });
  }
}

// DELETE /api/anggota/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { id } = await params;
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM anggota WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Anggota berhasil dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus data" }, { status: 500 });
  }
}
