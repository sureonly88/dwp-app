import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";
import { buildCurrentActiveCondition, ensureAnggotaSchema } from "@/lib/anggota";

// POST /api/arisan/[kegiatan_id]/undi — undi 1 pemenang acak (yang belum pernah menang di kegiatan ini)
export async function POST(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { kegiatan_id } = await params;

    await ensureAnggotaSchema();

    const [setupRows] = await pool.execute<RowDataPacket[]>(
      `SELECT jumlah_pemenang FROM arisan_setup WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );
    if (setupRows.length === 0) {
      return NextResponse.json({ error: "Setup arisan belum dibuat" }, { status: 400 });
    }
    const jumlahPemenang = Number(setupRows[0].jumlah_pemenang);

    const [winnerCountRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, COALESCE(MAX(urutan), 0) AS max_urutan
       FROM arisan_winners WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );
    const totalWinners = Number(winnerCountRows[0].total);
    const maxUrutan = Number(winnerCountRows[0].max_urutan);

    if (totalWinners >= jumlahPemenang) {
      return NextResponse.json(
        { error: `Jatah pemenang (${jumlahPemenang}) sudah penuh` },
        { status: 400 }
      );
    }

    // Pilih anggota Aktif yang:
    // 1. Hadir di kegiatan ini (ada di presensi)
    // 2. Belum jadi pemenang arisan di kegiatan ini
    // 3. Belum pernah menang arisan di tahun yang sama dengan kegiatan ini
    const [pickRows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.id, a.nama, a.nip, a.jabatan, a.unit_kerja,
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
       INNER JOIN presensi pr ON pr.anggota_id = a.id AND pr.kegiatan_id = ?
       WHERE ${buildCurrentActiveCondition("a")}
         AND a.status_keanggotaan IN ('Istri Karyawan', 'Karyawati')
         AND a.id NOT IN (
           SELECT anggota_id FROM arisan_winners WHERE kegiatan_id = ?
         )
         AND a.id NOT IN (
           SELECT aw.anggota_id
           FROM arisan_winners aw
           INNER JOIN kegiatan k ON k.id = aw.kegiatan_id
           WHERE YEAR(k.tanggal) = (SELECT YEAR(tanggal) FROM kegiatan WHERE id = ?)
         )
       ORDER BY RAND()
       LIMIT 1`,
      [kegiatan_id, kegiatan_id, kegiatan_id, kegiatan_id]
    );

    if (pickRows.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada peserta yang hadir dan memenuhi syarat untuk diundi" },
        { status: 400 }
      );
    }

    const picked = pickRows[0];
    const urutan = maxUrutan + 1;

    const [ins] = await pool.execute<ResultSetHeader>(
      `INSERT INTO arisan_winners (kegiatan_id, anggota_id, urutan) VALUES (?, ?, ?)`,
      [kegiatan_id, picked.id, urutan]
    );

    return NextResponse.json({
      message: "Pemenang terpilih",
      winner: {
        id: ins.insertId,
        anggota_id: picked.id,
        nama: picked.nama,
        nip: picked.nip,
        jabatan: picked.jabatan,
        unit_kerja: picked.unit_kerja,
        foto: picked.foto ?? null,
        urutan,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengundi" }, { status: 500 });
  }
}
