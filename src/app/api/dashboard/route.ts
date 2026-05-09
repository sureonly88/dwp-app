import { NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { computeKegiatanStatus } from "@/lib/kegiatanUtils";

export async function GET() {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const periodStart = `${year}-${month}-01`;
    const periodEnd = new Date(year, today.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    // Jalankan semua query independen secara paralel untuk meminimalkan latency DB
    const [
      [[anggotaRow]],
      [[unitRow]],
      [[kegiatanBulanIni]],
      [[tarifRow]],
      [upcomingRows],
      [recentAnggota],
      [unitDist],
      [kegiatanHistory],
    ] = await Promise.all([
      // 1. Anggota stats
      pool.execute<RowDataPacket[]>(`
        SELECT
          COUNT(*) AS total,
          SUM(status = 'Aktif') AS aktif,
          SUM(status = 'Non-Aktif') AS non_aktif,
          SUM(status = 'Cuti') AS cuti,
          SUM(jabatan <> 'Anggota' AND status = 'Aktif') AS pengurus_aktif
        FROM anggota
      `),
      // 2. Unit kerja aktif
      pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM unit_kerja WHERE aktif = 1"
      ),
      // 3. Kegiatan bulan ini
      pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM kegiatan WHERE tanggal BETWEEN ? AND ?`,
        [periodStart, periodEnd]
      ),
      // 4. Iuran bulan ini (tarif)
      pool.execute<RowDataPacket[]>(`
        SELECT nominal_anggota, nominal_pengurus
        FROM iuran_tarif
        WHERE aktif = 1 AND periode_mulai <= ?
        ORDER BY periode_mulai DESC LIMIT 1
      `, [periodEnd]),
      // 5. 5 kegiatan terdekat (mendatang/berlangsung)
      pool.execute<RowDataPacket[]>(`
        SELECT k.id, k.judul, k.tanggal, k.waktu_mulai, k.waktu_selesai,
               k.lokasi, k.status, k.kategori, k.target_peserta,
               COUNT(p.id) AS hadir_count
        FROM kegiatan k
        LEFT JOIN presensi p ON p.kegiatan_id = k.id
        WHERE k.tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY k.id
        ORDER BY k.tanggal ASC, k.waktu_mulai ASC
        LIMIT 5
      `),
      // 6. 5 anggota terbaru
      pool.execute<RowDataPacket[]>(`
        SELECT id, nama, nip, jabatan, unit_kerja, status, join_date
        FROM anggota
        ORDER BY join_date DESC, id DESC
        LIMIT 5
      `),
      // 7. Anggota per unit (untuk chart)
      pool.execute<RowDataPacket[]>(`
        SELECT unit_kerja AS unit, COUNT(*) AS total,
               SUM(status = 'Aktif') AS aktif
        FROM anggota
        GROUP BY unit_kerja
        ORDER BY aktif DESC
      `),
      // 8. Kegiatan selesai 6 bulan terakhir (untuk chart presensi)
      pool.execute<RowDataPacket[]>(`
        SELECT
          DATE_FORMAT(k.tanggal, '%b %Y') AS label,
          DATE_FORMAT(k.tanggal, '%Y-%m') AS bulan_key,
          COUNT(k.id) AS jumlah_kegiatan,
          COALESCE(SUM(ps.cnt), 0) AS total_hadir
        FROM kegiatan k
        LEFT JOIN (
          SELECT kegiatan_id, COUNT(*) AS cnt FROM presensi GROUP BY kegiatan_id
        ) ps ON ps.kegiatan_id = k.id
        WHERE k.tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND k.status IN ('Selesai', 'Berlangsung')
        GROUP BY bulan_key, label
        ORDER BY bulan_key ASC
      `),
    ]);

    // estimate total iuran bulan ini
    let estimasiIuran = 0;
    if (tarifRow && anggotaRow) {
      const na = Number(tarifRow.nominal_anggota ?? 0);
      const np = Number(tarifRow.nominal_pengurus ?? 0);
      const totalAktif = Number(anggotaRow.aktif ?? 0);
      const pengurusAktif = Number(anggotaRow.pengurus_aktif ?? 0);
      estimasiIuran = totalAktif * na + pengurusAktif * np;
    }

    const upcoming = (upcomingRows as RowDataPacket[]).map((r) => ({
      id: r.id,
      judul: r.judul,
      tanggal: r.tanggal,
      waktu_mulai: r.waktu_mulai,
      lokasi: r.lokasi,
      kategori: r.kategori,
      status: computeKegiatanStatus(r.tanggal, r.waktu_mulai, r.waktu_selesai, r.status),
      hadir: Number(r.hadir_count),
      target: r.target_peserta,
    }));

    return NextResponse.json({
      stats: {
        total_anggota: Number(anggotaRow?.total ?? 0),
        anggota_aktif: Number(anggotaRow?.aktif ?? 0),
        anggota_non_aktif: Number(anggotaRow?.non_aktif ?? 0),
        anggota_cuti: Number(anggotaRow?.cuti ?? 0),
        pengurus_aktif: Number(anggotaRow?.pengurus_aktif ?? 0),
        unit_kerja_aktif: Number(unitRow?.total ?? 0),
        kegiatan_bulan_ini: Number(kegiatanBulanIni?.total ?? 0),
        estimasi_iuran_bulan_ini: estimasiIuran,
      },
      upcoming,
      recent_anggota: recentAnggota,
      unit_dist: unitDist,
      kegiatan_history: kegiatanHistory,
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
