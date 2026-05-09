import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdmin } from "@/lib/kas";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// PUT /api/kas/kategori/[id] — admin only
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  try {
    const { id } = await params;
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const description = body.description ? String(body.description).trim() : null;
    const active = body.active === false ? 0 : 1;

    if (!name) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });

    await pool.execute<ResultSetHeader>(
      `UPDATE cash_categories SET name=?, description=?, active=? WHERE id=?`,
      [name, description, active, id]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal memperbarui kategori" }, { status: 400 });
  }
}

// DELETE /api/kas/kategori/[id] — admin only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  try {
    const { id } = await params;
    // Cek system / dipakai
    const [[cat]] = await pool.execute<RowDataPacket[]>(
      `SELECT is_system FROM cash_categories WHERE id=?`, [id]
    );
    if (!cat) return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
    if (Number(cat.is_system) === 1) {
      return NextResponse.json({ error: "Kategori sistem tidak dapat dihapus" }, { status: 400 });
    }
    const [[used]] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM cash_transactions WHERE category_id=?`, [id]
    );
    if (Number(used.c) > 0) {
      return NextResponse.json({ error: "Kategori sudah dipakai pada transaksi, nonaktifkan saja" }, { status: 400 });
    }
    await pool.execute(`DELETE FROM cash_categories WHERE id=?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus kategori" }, { status: 400 });
  }
}
