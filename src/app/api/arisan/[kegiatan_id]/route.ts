import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/arisan/[kegiatan_id] — setup + winners
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { kegiatan_id } = await params;

    const [kegRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, judul, tanggal, lokasi, kategori, status, event_code FROM kegiatan WHERE id = ?`,
      [kegiatan_id]
    );
    if (kegRows.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }

    const [setupRows] = await pool.execute<RowDataPacket[]>(
      `SELECT nominal_per_orang, jumlah_pemenang FROM arisan_setup WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );

    const [winners] = await pool.execute<RowDataPacket[]>(
      `SELECT w.id, w.anggota_id, w.urutan, w.waktu, a.nama, a.nip, a.unit_kerja, a.jabatan
       FROM arisan_winners w
       JOIN anggota a ON a.id = w.anggota_id
       WHERE w.kegiatan_id = ?
       ORDER BY w.urutan ASC`,
      [kegiatan_id]
    );

    // Jumlah anggota yang hadir di kegiatan ini
    const [hadirRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS hadir_count FROM presensi WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );

    // Jumlah peserta yang masih memenuhi syarat untuk diundi (hadir, aktif, belum menang tahun ini)
    const [eligibleRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS eligible_count
       FROM anggota a
       INNER JOIN presensi pr ON pr.anggota_id = a.id AND pr.kegiatan_id = ?
       WHERE a.status = 'Aktif'
         AND a.id NOT IN (
           SELECT anggota_id FROM arisan_winners WHERE kegiatan_id = ?
         )
         AND a.id NOT IN (
           SELECT aw.anggota_id
           FROM arisan_winners aw
           INNER JOIN kegiatan k ON k.id = aw.kegiatan_id
           WHERE YEAR(k.tanggal) = (SELECT YEAR(tanggal) FROM kegiatan WHERE id = ?)
         )`,
      [kegiatan_id, kegiatan_id, kegiatan_id]
    );

    // Nama anggota hadir untuk animasi roll — hanya anggota yang hadir di kegiatan ini
    const [rollRows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT a.nama
       FROM anggota a
       INNER JOIN presensi pr ON pr.anggota_id = a.id
       WHERE pr.kegiatan_id = ?
         AND COALESCE(NULLIF(TRIM(a.nama), ''), '') <> ''
       ORDER BY a.nama ASC`,
      [kegiatan_id]
    );
    const rollNames = rollRows
      .map((row) => String(row.nama ?? "").trim())
      .filter(Boolean);

    return NextResponse.json({
      kegiatan: kegRows[0],
      setup: setupRows[0] ?? null,
      winners,
      hadir_count: Number(hadirRows[0].hadir_count),
      eligible_count: Number(eligibleRows[0].eligible_count),
      roll_names: rollNames,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data arisan" }, { status: 500 });
  }
}

// PUT /api/arisan/[kegiatan_id] — upsert setup
export async function PUT(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { kegiatan_id } = await params;
    const body = await req.json();
    const nominal = Number(body.nominal_per_orang ?? 0);
    const jumlah = Math.max(1, Number(body.jumlah_pemenang ?? 1));

    if (!Number.isFinite(nominal) || nominal < 0) {
      return NextResponse.json({ error: "Nominal tidak valid" }, { status: 400 });
    }
    if (!Number.isFinite(jumlah) || jumlah < 1) {
      return NextResponse.json({ error: "Jumlah pemenang tidak valid" }, { status: 400 });
    }

    const [kegRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM kegiatan WHERE id = ?`,
      [kegiatan_id]
    );
    if (kegRows.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }

    await pool.execute<ResultSetHeader>(
      `INSERT INTO arisan_setup (kegiatan_id, nominal_per_orang, jumlah_pemenang)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE nominal_per_orang = VALUES(nominal_per_orang), jumlah_pemenang = VALUES(jumlah_pemenang)`,
      [kegiatan_id, nominal, jumlah]
    );

    return NextResponse.json({ message: "Setup arisan tersimpan" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan setup" }, { status: 500 });
  }
}

// DELETE /api/arisan/[kegiatan_id] — hapus setup + semua pemenang
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { kegiatan_id } = await params;
    await pool.execute(`DELETE FROM arisan_winners WHERE kegiatan_id = ?`, [kegiatan_id]);
    await pool.execute(`DELETE FROM arisan_setup WHERE kegiatan_id = ?`, [kegiatan_id]);
    return NextResponse.json({ message: "Arisan direset" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mereset arisan" }, { status: 500 });
  }
}
