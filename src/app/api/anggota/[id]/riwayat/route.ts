import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

// GET /api/anggota/[id]/riwayat
// Returns: presensi history, arisan wins, doorprize wins for one member
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const anggotaId = parseInt(id, 10);
    if (isNaN(anggotaId)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    // Jalankan ketiga query secara paralel — tidak ada dependensi antar-query
    const [presensiRows, arisanRows, doorprizeRows] = await Promise.all([
      pool.execute<RowDataPacket[]>(
        `SELECT k.id AS kegiatan_id, k.judul, k.tanggal, k.kategori, k.lokasi, k.status,
                p.waktu_hadir, p.metode
         FROM presensi p
         JOIN kegiatan k ON k.id = p.kegiatan_id
         WHERE p.anggota_id = ?
         ORDER BY k.tanggal DESC, p.waktu_hadir DESC`,
        [anggotaId]
      ).then(([rows]) => rows),
      pool.execute<RowDataPacket[]>(
        `SELECT aw.id, aw.urutan, aw.waktu,
                k.id AS kegiatan_id, k.judul AS kegiatan_judul, k.tanggal AS kegiatan_tanggal,
                s.nominal_per_orang
         FROM arisan_winners aw
         JOIN kegiatan k ON k.id = aw.kegiatan_id
         LEFT JOIN arisan_setup s ON s.kegiatan_id = k.id
         WHERE aw.anggota_id = ?
         ORDER BY k.tanggal DESC`,
        [anggotaId]
      ).then(([rows]) => rows),
      pool.execute<RowDataPacket[]>(
        `SELECT dw.id, dw.waktu,
                dh.nama_hadiah,
                k.id AS kegiatan_id, k.judul AS kegiatan_judul, k.tanggal AS kegiatan_tanggal
         FROM doorprize_winners dw
         JOIN doorprize_hadiah dh ON dh.id = dw.hadiah_id
         JOIN kegiatan k ON k.id = dw.kegiatan_id
         WHERE dw.anggota_id = ?
         ORDER BY k.tanggal DESC`,
        [anggotaId]
      ).then(([rows]) => rows),
    ]);

    return NextResponse.json({
      presensi: presensiRows,
      arisan: arisanRows,
      doorprize: doorprizeRows,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil riwayat" }, { status: 500 });
  }
}
