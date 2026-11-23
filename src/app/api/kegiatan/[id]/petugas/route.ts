import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";
import pool from "@/lib/db";
import { simpanPetugasKegiatan, type PetugasKegiatan } from "@/lib/kegiatan-petugas";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const search = req.nextUrl.searchParams.get("search")?.trim();
    if (search !== undefined) {
      if (search.length < 2) return NextResponse.json({ data: [] });
      const like = `%${search}%`;
      const [rows] = await pool.execute<(PetugasKegiatan & RowDataPacket)[]>(
        `SELECT p.anggota_id, a.nama, a.nip, a.unit_kerja
         FROM presensi p
         INNER JOIN anggota a ON a.id = p.anggota_id
         WHERE p.kegiatan_id = ? AND (a.nama LIKE ? OR a.nip LIKE ?)
         ORDER BY a.nama, a.id
         LIMIT 8`,
        [id, like, like],
      );
      return NextResponse.json({ data: rows });
    }

    const [rows] = await pool.execute<(PetugasKegiatan & RowDataPacket)[]>(
      `SELECT kp.anggota_id, a.nama, a.nip, a.unit_kerja
       FROM kegiatan_petugas kp
       INNER JOIN anggota a ON a.id = kp.anggota_id
       WHERE kp.kegiatan_id = ?
       ORDER BY a.nama, a.id`,
      [id],
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal memuat daftar petugas" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const anggotaId = body?.anggota_id;
    if (!Number.isSafeInteger(anggotaId) || anggotaId <= 0) {
      return NextResponse.json({ error: "Anggota wajib dipilih" }, { status: 400 });
    }

    const tersimpan = await simpanPetugasKegiatan(id, anggotaId);
    if (!tersimpan) {
      return NextResponse.json({ error: "Anggota belum tercatat hadir pada kegiatan ini" }, { status: 409 });
    }
    return NextResponse.json({ message: "Petugas ditambahkan" });
  } catch (err) {
    if ((err as { code?: string }).code === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json({ error: "Kegiatan atau anggota tidak ditemukan" }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menambahkan petugas" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { id } = await params;
    const anggotaId = Number(req.nextUrl.searchParams.get("anggota_id"));
    if (!Number.isSafeInteger(anggotaId) || anggotaId <= 0) {
      return NextResponse.json({ error: "Anggota wajib dipilih" }, { status: 400 });
    }

    await pool.execute(
      "DELETE FROM kegiatan_petugas WHERE kegiatan_id = ? AND anggota_id = ?",
      [id, anggotaId],
    );
    return NextResponse.json({ message: "Petugas dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus petugas" }, { status: 500 });
  }
}
