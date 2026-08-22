import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { requireAdmin } from "@/lib/admin-auth";
import { buildCurrentActiveCondition, buildEffectiveStatusSql, ensureAnggotaSchema } from "@/lib/anggota";
import { normalizeNoHp } from "@/lib/no-hp";
import { isUnitKerjaTerdaftar, normalizeUnitKerja } from "@/lib/unit-kerja";

interface PresensiRow extends RowDataPacket {
  id: number;
  kegiatan_id: number;
  anggota_id: number;
  waktu_hadir: string;
  metode: "QR" | "Manual";
  catatan: string | null;
  foto: string | null;
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status_keanggotaan: "Istri Karyawan" | "Karyawati" | "Pengurus";
}

// GET /api/kegiatan/[id]/presensi?search=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAnggotaSchema();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";

    const conditions = ["p.kegiatan_id = ?"];
    const args: (string | number)[] = [id];
    if (search) {
      conditions.push("(a.nama LIKE ? OR a.nip LIKE ?)");
      args.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.execute<PresensiRow[]>(
      `SELECT p.id, p.kegiatan_id, p.anggota_id, p.waktu_hadir, p.metode, p.catatan, p.foto,
              a.nama, a.nip, a.jabatan, a.unit_kerja, a.status_keanggotaan
       FROM presensi p
       INNER JOIN anggota a ON a.id = p.anggota_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.waktu_hadir DESC`,
      args
    );

    return NextResponse.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil daftar hadir" }, { status: 500 });
  }
}

// POST /api/kegiatan/[id]/presensi  body: { anggota_id?, nip?, metode?, catatan?, no_hp?, unit_kerja?, foto? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let conn: PoolConnection | undefined;
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { id } = await params;
    const body = await req.json();
    const { anggota_id, nip, metode, catatan } = body;
    const normalizedNoHp = normalizeNoHp(body.no_hp);
    const normalizedUnitKerja = normalizeUnitKerja(body.unit_kerja);
    const foto: string | null = typeof body.foto === "string" && body.foto.startsWith("data:image/") ? body.foto : null;
    if (foto && foto.length > 900_000) {
      return NextResponse.json({ error: "Ukuran foto terlalu besar (maks ~700KB)" }, { status: 413 });
    }
    if (normalizedNoHp.error) {
      return NextResponse.json({ error: normalizedNoHp.error }, { status: 400 });
    }
    if (normalizedUnitKerja.error) {
      return NextResponse.json({ error: normalizedUnitKerja.error }, { status: 400 });
    }

    if (!anggota_id && !nip) {
      return NextResponse.json({ error: "anggota_id atau nip wajib diisi" }, { status: 400 });
    }

    // Validate kegiatan exists & not Dibatalkan
    const [keg] = await pool.execute<RowDataPacket[]>(
      "SELECT id, status, judul FROM kegiatan WHERE id = ? LIMIT 1",
      [id]
    );
    if (keg.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }
    if ((keg[0] as { status: string }).status === "Dibatalkan") {
      return NextResponse.json({ error: "Kegiatan sudah dibatalkan" }, { status: 400 });
    }

    // Resolve anggota
    let resolvedId: number | null = anggota_id ?? null;
    let nama = "";
    let currentUnitKerja = "";
    const effectiveStatusSql = buildEffectiveStatusSql();
    if (!resolvedId) {
      const [a] = await pool.execute<RowDataPacket[]>(
        `SELECT id, nama, unit_kerja, ${effectiveStatusSql} AS status FROM anggota WHERE nip = ? LIMIT 1`,
        [nip]
      );
      if (a.length === 0) {
        return NextResponse.json({ error: "NIP tidak terdaftar sebagai anggota" }, { status: 404 });
      }
      if ((a[0] as { status: string }).status === "Non-Aktif") {
        return NextResponse.json({ error: "Anggota berstatus Non-Aktif tidak dapat dicatat hadir sebagai anggota DWP" }, { status: 400 });
      }
      resolvedId = (a[0] as { id: number }).id;
      nama = (a[0] as { nama: string }).nama;
      currentUnitKerja = (a[0] as { unit_kerja: string }).unit_kerja;
    } else {
      const [a] = await pool.execute<RowDataPacket[]>(
        `SELECT nama, unit_kerja, ${effectiveStatusSql} AS status FROM anggota WHERE id = ? LIMIT 1`,
        [resolvedId]
      );
      if (a.length === 0) {
        return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
      }
      if ((a[0] as { status: string }).status === "Non-Aktif") {
        return NextResponse.json({ error: "Anggota berstatus Non-Aktif tidak dapat dicatat hadir sebagai anggota DWP" }, { status: 400 });
      }
      nama = (a[0] as { nama: string }).nama;
      currentUnitKerja = (a[0] as { unit_kerja: string }).unit_kerja;
    }
    if (
      normalizedUnitKerja.value &&
      normalizedUnitKerja.value !== currentUnitKerja &&
      !(await isUnitKerjaTerdaftar(normalizedUnitKerja.value))
    ) {
      return NextResponse.json({ error: "Unit kerja tidak terdaftar" }, { status: 400 });
    }

    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO presensi (kegiatan_id, anggota_id, metode, catatan, foto)
         VALUES (?, ?, ?, ?, ?)`,
        [id, resolvedId, metode === "Manual" ? "Manual" : "QR", catatan ?? null, foto]
      );

      const updateFields: string[] = [];
      const updateParams: string[] = [];
      if (normalizedNoHp.value) {
        updateFields.push("no_hp = ?");
        updateParams.push(normalizedNoHp.value);
      }
      if (normalizedUnitKerja.value && normalizedUnitKerja.value !== currentUnitKerja) {
        updateFields.push("unit_kerja = ?");
        updateParams.push(normalizedUnitKerja.value);
      }
      if (updateFields.length > 0) {
        await conn.execute(
          `UPDATE anggota SET ${updateFields.join(", ")} WHERE id = ?`,
          [...updateParams, resolvedId]
        );
      }

      await conn.commit();

      return NextResponse.json(
        { id: result.insertId, anggota_id: resolvedId, nama, message: `Kehadiran ${nama} tercatat` },
        { status: 201 }
      );
    } catch (e: unknown) {
      if (conn) await conn.rollback();
      if ((e as { code?: string }).code === "ER_DUP_ENTRY") {
        return NextResponse.json(
          { error: `${nama} sudah tercatat hadir sebelumnya`, duplicate: true },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mencatat kehadiran" }, { status: 500 });
  } finally {
    conn?.release();
  }
}

// PUT /api/kegiatan/[id]/presensi  — hadirkan semua anggota aktif sekaligus
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { id } = await params;

    // Validate kegiatan exists & not Dibatalkan
    const [keg] = await pool.execute<RowDataPacket[]>(
      "SELECT id, status FROM kegiatan WHERE id = ? LIMIT 1",
      [id]
    );
    if (keg.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }
    if ((keg[0] as { status: string }).status === "Dibatalkan") {
      return NextResponse.json({ error: "Kegiatan sudah dibatalkan" }, { status: 400 });
    }

    // Insert semua anggota aktif yang belum tercatat, gunakan INSERT IGNORE untuk skip duplikat
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO presensi (kegiatan_id, anggota_id, metode)
       SELECT ?, id, 'Manual'
       FROM anggota
       WHERE ${buildCurrentActiveCondition()}`,
      [id]
    );

    return NextResponse.json({
      message: `${result.affectedRows} anggota berhasil dicatat hadir`,
      inserted: result.affectedRows,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mencatat semua kehadiran" }, { status: 500 });
  }
}

// DELETE /api/kegiatan/[id]/presensi?presensi_id=  (single)
// DELETE /api/kegiatan/[id]/presensi?all=1          (bulk: hapus seluruh daftar hadir)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const presensiId = searchParams.get("presensi_id");
    const all = searchParams.get("all");

    if (all === "1") {
      const [result] = await pool.execute<ResultSetHeader>(
        "DELETE FROM presensi WHERE kegiatan_id = ?",
        [id]
      );
      return NextResponse.json({
        message: `${result.affectedRows} data presensi dihapus`,
        deleted: result.affectedRows,
      });
    }

    if (!presensiId) {
      return NextResponse.json({ error: "presensi_id wajib" }, { status: 400 });
    }
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM presensi WHERE id = ? AND kegiatan_id = ?",
      [presensiId, id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Data presensi tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Presensi dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus presensi" }, { status: 500 });
  }
}
