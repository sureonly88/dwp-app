import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";
import { pickRandomDoorprizeCandidate } from "@/lib/doorprize";

// POST /api/doorprize/[kegiatan_id]/undi — auto-undian satu pemenang doorprize
export async function POST(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const { kegiatan_id } = await params;

    // Check setup
    const [setupRows] = await pool.execute<RowDataPacket[]>(
      `SELECT jumlah_hadiah FROM doorprize_setup WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );
    if (setupRows.length === 0) {
      return NextResponse.json({ error: "Setup doorprize belum dikonfigurasi" }, { status: 400 });
    }
    const jumlahHadiah: number = setupRows[0].jumlah_hadiah;

    // Count current winners
    const [cntRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM doorprize_winners WHERE kegiatan_id = ?`,
      [kegiatan_id]
    );
    const currentCount: number = cntRows[0].cnt;

    if (currentCount >= jumlahHadiah) {
      return NextResponse.json({ error: "Semua hadiah sudah terisi" }, { status: 400 });
    }

    const winner = await pickRandomDoorprizeCandidate(kegiatan_id);
    if (!winner) {
      return NextResponse.json({ error: "Tidak ada peserta yang hadir dan belum menang doorprize" }, { status: 400 });
    }
    const urutan = currentCount + 1;

    // Auto-create hadiah entry
    const [hadiahRes] = await pool.execute<ResultSetHeader>(
      `INSERT INTO doorprize_hadiah (kegiatan_id, nama_hadiah, urutan) VALUES (?, ?, ?)`,
      [kegiatan_id, `Hadiah ke-${urutan}`, urutan]
    );
    const hadiahId = hadiahRes.insertId;

    // Insert winner
    const [winnerRes] = await pool.execute<ResultSetHeader>(
      `INSERT INTO doorprize_winners (kegiatan_id, hadiah_id, peserta_tipe, anggota_id, tamu_id) VALUES (?, ?, ?, ?, ?)`,
      [kegiatan_id, hadiahId, winner.peserta_tipe, winner.anggota_id, winner.tamu_id]
    );

    return NextResponse.json({
      winner: {
        id: winnerRes.insertId,
        urutan,
        peserta_tipe: winner.peserta_tipe,
        anggota_id: winner.anggota_id,
        tamu_id: winner.tamu_id,
        nama: winner.nama,
        nip: winner.nip,
        jabatan: winner.jabatan,
        unit_kerja: winner.unit_kerja,
        instansi: winner.instansi,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengundi" }, { status: 500 });
  }
}
