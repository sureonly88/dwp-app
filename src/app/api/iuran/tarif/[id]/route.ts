import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureIuranTarifSchema } from "@/lib/iuran";
import type { ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";

// PUT /api/iuran/tarif/[id] — update tarif (nominal/aktif/catatan)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    await ensureIuranTarifSchema();

    const { id } = await params;
    const body = await req.json();
    const nominal_anggota = Number(body.nominal_anggota);
    const nominal_konsumsi_anggota = Number(body.nominal_konsumsi_anggota ?? 0);
    const nominal_pengurus = Number(body.nominal_pengurus);
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

    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE iuran_tarif SET nominal_anggota=?, nominal_konsumsi_anggota=?, nominal_pengurus=?, aktif=?, catatan=? WHERE id=?`,
      [nominal_anggota, nominal_konsumsi_anggota, nominal_pengurus, aktif, catatan, id]
    );
    if (res.affectedRows === 0) {
      return NextResponse.json({ error: "Tarif tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Tarif diperbarui" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal memperbarui tarif" }, { status: 500 });
  }
}

// DELETE /api/iuran/tarif/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { id } = await params;
    const [res] = await pool.execute<ResultSetHeader>(
      `DELETE FROM iuran_tarif WHERE id=?`,
      [id]
    );
    if (res.affectedRows === 0) {
      return NextResponse.json({ error: "Tarif tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Tarif dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus tarif" }, { status: 500 });
  }
}
