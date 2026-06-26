import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";
import { countDoorprizePresentParticipants, listEligibleDoorprizeCandidates, listHadirAnggotaDoorprizeNames } from "@/lib/doorprize";

// GET /api/doorprize/[kegiatan_id] — kegiatan + setup + flat winners list
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
      `SELECT jumlah_hadiah FROM doorprize_setup WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );

    const [winnerRows] = await pool.execute<RowDataPacket[]>(
      `SELECT w.id, h.id AS hadiah_id, h.nama_hadiah, h.urutan, w.peserta_tipe,
              COALESCE(a.nama, pt.nama) AS nama,
              a.nip,
              CASE
                WHEN w.peserta_tipe = 'tamu' THEN 'Tamu'
                ELSE a.jabatan
              END AS jabatan,
              CASE
                WHEN w.peserta_tipe = 'tamu' THEN COALESCE(NULLIF(TRIM(pt.instansi), ''), 'Tamu Non-Anggota')
                ELSE a.unit_kerja
              END AS unit_kerja,
              CASE
                WHEN w.peserta_tipe = 'tamu' THEN CASE
                  WHEN pt.foto IS NOT NULL AND TRIM(pt.foto) <> '' THEN pt.foto
                  ELSE NULL
                END
                ELSE (
                  SELECT p.foto
                  FROM presensi p
                  WHERE p.kegiatan_id = w.kegiatan_id
                    AND p.anggota_id = w.anggota_id
                    AND p.foto IS NOT NULL
                    AND TRIM(p.foto) <> ''
                  ORDER BY p.waktu_hadir DESC, p.id DESC
                  LIMIT 1
                )
              END AS foto,
              pt.instansi,
              w.waktu,
              w.anggota_id,
              w.tamu_id
       FROM doorprize_winners w
       JOIN doorprize_hadiah h ON h.id = w.hadiah_id
       LEFT JOIN anggota a ON a.id = w.anggota_id
       LEFT JOIN presensi_tamu pt ON pt.id = w.tamu_id
       WHERE w.kegiatan_id = ?
       ORDER BY h.urutan ASC`,
      [kegiatan_id]
    );

    const winners = winnerRows.map((winner, index) => ({
      ...winner,
      urutan: index + 1,
    }));

    const hadiahToNormalize = winnerRows.filter((winner, index) => Number(winner.urutan) !== index + 1);
    if (hadiahToNormalize.length > 0) {
      await Promise.all(
        winnerRows.map((winner, index) => {
          const urutanBaru = index + 1;
          return pool.execute<ResultSetHeader>(
            `UPDATE doorprize_hadiah
             SET urutan = ?,
                 nama_hadiah = CASE
                   WHEN nama_hadiah REGEXP '^Hadiah ke-[0-9]+$' THEN ?
                   ELSE nama_hadiah
                 END
             WHERE id = ?`,
            [urutanBaru, `Hadiah ke-${urutanBaru}`, winner.hadiah_id]
          );
        })
      );
    }

    const [hadirCount, eligibleCandidates, rollNames] = await Promise.all([
      countDoorprizePresentParticipants(kegiatan_id),
      listEligibleDoorprizeCandidates(kegiatan_id),
      listHadirAnggotaDoorprizeNames(kegiatan_id),
    ]);

    return NextResponse.json({
      kegiatan: kegRows[0],
      setup: setupRows[0] ?? null,
      winners,
      hadir_count: hadirCount,
      eligible_count: eligibleCandidates.length,
      roll_names: rollNames,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

// PUT /api/doorprize/[kegiatan_id] — upsert setup (jumlah_hadiah)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { kegiatan_id } = await params;
    const body = await req.json();
    const jumlah = Number(body.jumlah_hadiah);
    if (!Number.isInteger(jumlah) || jumlah < 1) {
      return NextResponse.json({ error: "Jumlah hadiah tidak valid" }, { status: 400 });
    }
    await pool.execute<ResultSetHeader>(
      `INSERT INTO doorprize_setup (kegiatan_id, jumlah_hadiah)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE jumlah_hadiah = VALUES(jumlah_hadiah)`,
      [kegiatan_id, jumlah]
    );
    return NextResponse.json({ jumlah_hadiah: jumlah });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan setup" }, { status: 500 });
  }
}

// DELETE /api/doorprize/[kegiatan_id] — reset semua data doorprize kegiatan ini
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { kegiatan_id } = await params;
    await pool.execute(`DELETE FROM doorprize_winners WHERE kegiatan_id = ?`, [kegiatan_id]);
    await pool.execute(`DELETE FROM doorprize_hadiah WHERE kegiatan_id = ?`, [kegiatan_id]);
    await pool.execute(`DELETE FROM doorprize_setup WHERE kegiatan_id = ?`, [kegiatan_id]);
    return NextResponse.json({ message: "Data doorprize direset" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mereset data" }, { status: 500 });
  }
}
