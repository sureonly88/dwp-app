import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { buildEffectiveStatusSql } from "@/lib/anggota";
import { normalizeNoHp } from "@/lib/no-hp";
import { isUnitKerjaTerdaftar, normalizeUnitKerja } from "@/lib/unit-kerja";

// GET /api/presensi/[code] -> info kegiatan
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT k.id, k.judul, k.deskripsi, k.tanggal, k.waktu_mulai, k.waktu_selesai,
              k.lokasi, k.kategori, k.status, k.event_code,
              (SELECT COUNT(*) FROM presensi p WHERE p.kegiatan_id = k.id) AS hadir_count
       FROM kegiatan k WHERE k.event_code = ? LIMIT 1`,
      [code]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Kode kegiatan tidak valid" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

// POST /api/presensi/[code]   body: { anggota_id?, nip?, no_hp?, unit_kerja?, foto? (data URL) }
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  let conn: PoolConnection | undefined;
  try {
    const { code } = await params;
    const body = await req.json();
    const anggotaId: number | null = body.anggota_id ? Number(body.anggota_id) : null;
    const nip: string = (body.nip ?? "").toString().trim();
    const normalizedNoHp = normalizeNoHp(body.no_hp);
    const normalizedUnitKerja = normalizeUnitKerja(body.unit_kerja);
    const foto: string | null = typeof body.foto === "string" && body.foto.startsWith("data:image/")
      ? body.foto
      : null;

    if (!anggotaId && !nip) {
      return NextResponse.json({ error: "Anggota wajib dipilih" }, { status: 400 });
    }
    if (normalizedNoHp.error) {
      return NextResponse.json({ error: normalizedNoHp.error }, { status: 400 });
    }
    if (normalizedUnitKerja.error) {
      return NextResponse.json({ error: normalizedUnitKerja.error }, { status: 400 });
    }

    // Validate foto size (~700KB max in base64 ≈ 525KB binary)
    if (foto && foto.length > 900_000) {
      return NextResponse.json({ error: "Ukuran foto terlalu besar (maks ~700KB)" }, { status: 413 });
    }

    const [keg] = await pool.execute<RowDataPacket[]>(
      "SELECT id, judul, status FROM kegiatan WHERE event_code = ? LIMIT 1",
      [code]
    );
    if (keg.length === 0) {
      return NextResponse.json({ error: "Kode kegiatan tidak valid" }, { status: 404 });
    }
    const kegiatan = keg[0] as { id: number; judul: string; status: string };
    if (kegiatan.status === "Dibatalkan") {
      return NextResponse.json({ error: "Kegiatan sudah dibatalkan" }, { status: 400 });
    }
    if (kegiatan.status === "Selesai") {
      return NextResponse.json({ error: "Presensi untuk kegiatan ini sudah ditutup" }, { status: 400 });
    }

    const effectiveStatusSql = buildEffectiveStatusSql();
    const [a] = await pool.execute<RowDataPacket[]>(
      anggotaId
        ? `SELECT id, nama, jabatan, unit_kerja, ${effectiveStatusSql} AS status FROM anggota WHERE id = ? LIMIT 1`
        : `SELECT id, nama, jabatan, unit_kerja, ${effectiveStatusSql} AS status FROM anggota WHERE nip = ? LIMIT 1`,
      [anggotaId ?? nip]
    );
    if (a.length === 0) {
      return NextResponse.json({ error: "Anggota tidak terdaftar" }, { status: 404 });
    }
    const anggota = a[0] as { id: number; nama: string; jabatan: string; unit_kerja: string; status: string };
    if (anggota.status === "Non-Aktif") {
      return NextResponse.json({ error: "Anggota berstatus Non-Aktif" }, { status: 400 });
    }
    if (
      normalizedUnitKerja.value &&
      normalizedUnitKerja.value !== anggota.unit_kerja &&
      !(await isUnitKerjaTerdaftar(normalizedUnitKerja.value))
    ) {
      return NextResponse.json({ error: "Unit kerja tidak terdaftar" }, { status: 400 });
    }

    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();

      await conn.execute<ResultSetHeader>(
        `INSERT INTO presensi (kegiatan_id, anggota_id, metode, foto) VALUES (?, ?, 'QR', ?)`,
        [kegiatan.id, anggota.id, foto]
      );

      const updateFields: string[] = [];
      const updateParams: string[] = [];
      if (normalizedNoHp.value) {
        updateFields.push("no_hp = ?");
        updateParams.push(normalizedNoHp.value);
      }
      if (normalizedUnitKerja.value && normalizedUnitKerja.value !== anggota.unit_kerja) {
        updateFields.push("unit_kerja = ?");
        updateParams.push(normalizedUnitKerja.value);
      }
      if (updateFields.length > 0) {
        await conn.execute(
          `UPDATE anggota SET ${updateFields.join(", ")} WHERE id = ?`,
          [...updateParams, anggota.id]
        );
      }

      await conn.commit();

      return NextResponse.json({
        message: "Kehadiran berhasil dicatat",
        anggota: {
          nama: anggota.nama,
          jabatan: anggota.jabatan,
          unit_kerja: normalizedUnitKerja.value ?? anggota.unit_kerja,
        },
        kegiatan: { judul: kegiatan.judul },
      }, { status: 201 });
    } catch (e: unknown) {
      if (conn) await conn.rollback();
      if ((e as { code?: string }).code === "ER_DUP_ENTRY") {
        return NextResponse.json({
          error: `${anggota.nama} sudah tercatat hadir sebelumnya`,
          duplicate: true,
          anggota: { nama: anggota.nama },
        }, { status: 409 });
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
