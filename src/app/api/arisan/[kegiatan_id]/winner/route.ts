import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";
import { buildEffectiveStatusSql, ensureAnggotaSchema } from "@/lib/anggota";

// POST /api/arisan/[kegiatan_id]/winner — input manual penerima arisan
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ kegiatan_id: string }> },
) {
  const { response } = await requireAdmin(req);
  if (response) return response;
  try {
    await ensureAnggotaSchema();

    const { kegiatan_id } = await params;
    const body = await req.json();
    const anggotaId = Number(body.anggota_id);

    if (!Number.isInteger(anggotaId) || anggotaId <= 0) {
      return NextResponse.json({ error: "Anggota wajib dipilih" }, { status: 400 });
    }

    const [kegiatanRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, YEAR(tanggal) AS tahun FROM kegiatan WHERE id = ?`,
      [kegiatan_id],
    );
    if (kegiatanRows.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }

    const effectiveStatusSql = buildEffectiveStatusSql();
    const [anggotaRows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.id, a.nama, a.nip, a.jabatan, a.unit_kerja, a.status_keanggotaan, ${effectiveStatusSql} AS status,
              (
                SELECT p.foto
                FROM presensi p
                WHERE p.kegiatan_id = ?
                  AND p.anggota_id = a.id
                  AND p.foto IS NOT NULL
                  AND TRIM(p.foto) <> ''
                ORDER BY p.waktu_hadir DESC, p.id DESC
                LIMIT 1
              ) AS foto
       FROM anggota a
       WHERE a.id = ?`,
      [kegiatan_id, anggotaId],
    );
    if (anggotaRows.length === 0) {
      return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
    }
    if (anggotaRows[0].status !== "Aktif") {
      return NextResponse.json({ error: "Hanya anggota aktif yang dapat dicatat sebagai penerima arisan" }, { status: 400 });
    }
    if (!["Istri Karyawan", "Karyawati"].includes(String(anggotaRows[0].status_keanggotaan ?? ""))) {
      return NextResponse.json({ error: "Penerima arisan hanya berlaku untuk Istri Karyawan dan Karyawati" }, { status: 400 });
    }

    const [existingSameEventRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM arisan_winners WHERE kegiatan_id = ? AND anggota_id = ? LIMIT 1`,
      [kegiatan_id, anggotaId],
    );
    if (existingSameEventRows.length > 0) {
      return NextResponse.json({ error: "Anggota ini sudah tercatat sebagai penerima pada kegiatan tersebut" }, { status: 409 });
    }

    const [existingSameYearRows] = await pool.execute<RowDataPacket[]>(
      `SELECT aw.id, k.judul
       FROM arisan_winners aw
       INNER JOIN kegiatan k ON k.id = aw.kegiatan_id
       WHERE aw.anggota_id = ? AND YEAR(k.tanggal) = ?
       LIMIT 1`,
      [anggotaId, Number(kegiatanRows[0].tahun)],
    );
    if (existingSameYearRows.length > 0) {
      return NextResponse.json(
        { error: `Anggota ini sudah pernah menerima arisan pada tahun yang sama (${existingSameYearRows[0].judul})` },
        { status: 409 },
      );
    }

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(MAX(urutan), 0) AS max_urutan FROM arisan_winners WHERE kegiatan_id = ?`,
      [kegiatan_id],
    );
    const urutan = Number(countRows[0].max_urutan) + 1;

    const [ins] = await pool.execute<ResultSetHeader>(
      `INSERT INTO arisan_winners (kegiatan_id, anggota_id, urutan) VALUES (?, ?, ?)`,
      [kegiatan_id, anggotaId, urutan],
    );

    return NextResponse.json({
      message: "Penerima arisan berhasil dicatat",
      winner: {
        id: ins.insertId,
        anggota_id: anggotaRows[0].id,
        nama: anggotaRows[0].nama,
        nip: anggotaRows[0].nip,
        jabatan: anggotaRows[0].jabatan,
        unit_kerja: anggotaRows[0].unit_kerja,
        foto: anggotaRows[0].foto ?? null,
        urutan,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Anggota ini sudah tercatat sebagai penerima arisan" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal mencatat penerima arisan" }, { status: 500 });
  }
}
