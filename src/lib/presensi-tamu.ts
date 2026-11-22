import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import type { KegiatanStatus } from "@/lib/kegiatanUtils";

interface KegiatanRow extends RowDataPacket {
  id: number;
  status: KegiatanStatus;
}

export async function catatPresensiTamu(req: Request, kegiatan: { id: string } | { code: string }) {
  try {
    const body = await req.json();
    const nama = String(body.nama ?? "").trim();
    if (!nama) {
      return NextResponse.json({ error: "Nama tamu wajib diisi" }, { status: 400 });
    }
    const instansi = body.instansi ? String(body.instansi).trim() || null : null;
    const keterangan = body.keterangan ? String(body.keterangan).trim() || null : null;
    const foto = typeof body.foto === "string" && body.foto.startsWith("data:image/") ? body.foto : null;
    if (foto && foto.length > 900_000) {
      return NextResponse.json({ error: "Ukuran foto terlalu besar (maks ~700KB)" }, { status: 413 });
    }

    const lewatKode = "code" in kegiatan;
    const [[acara]] = await pool.execute<KegiatanRow[]>(
      lewatKode
        ? "SELECT id, status FROM kegiatan WHERE event_code = ? LIMIT 1"
        : "SELECT id, status FROM kegiatan WHERE id = ? LIMIT 1",
      [lewatKode ? kegiatan.code : kegiatan.id]
    );
    if (!acara) {
      const error = lewatKode ? "Kode kegiatan tidak valid" : "Kegiatan tidak ditemukan";
      return NextResponse.json({ error }, { status: 404 });
    }
    if (acara.status === "Dibatalkan") {
      return NextResponse.json({ error: "Kegiatan sudah dibatalkan" }, { status: 400 });
    }
    if (lewatKode && acara.status === "Selesai") {
      return NextResponse.json({ error: "Presensi untuk kegiatan ini sudah ditutup" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO presensi_tamu (kegiatan_id, nama, instansi, keterangan, foto) VALUES (?, ?, ?, ?, ?)",
      [acara.id, nama, instansi, keterangan, foto]
    );
    return NextResponse.json(
      { id: result.insertId, nama, message: `Kehadiran tamu ${nama} tercatat` },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mencatat kehadiran tamu" }, { status: 500 });
  }
}
