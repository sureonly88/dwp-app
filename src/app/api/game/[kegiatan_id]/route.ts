import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";
import {
  countGamePresentParticipants,
  ensureGameSetupSchema,
  listEligibleGameCandidates,
  listHadirAnggotaGameNames,
} from "@/lib/game";

// GET /api/game/[kegiatan_id] — kegiatan + daftar setup game + peserta terpilih game aktif
export async function GET(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    await ensureGameSetupSchema();

    const { kegiatan_id } = await params;
    const gameIdParam = req.nextUrl.searchParams.get("game_id");
    const parsedGameId = gameIdParam ? Number(gameIdParam) : Number.NaN;
    const requestedGameId = Number.isInteger(parsedGameId) && parsedGameId > 0 ? parsedGameId : null;

    const [kegRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, judul, tanggal, lokasi, kategori, status, event_code FROM kegiatan WHERE id = ?`,
      [kegiatan_id]
    );
    if (kegRows.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }

    const [setupRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, nama_game, jumlah_hadiah, jumlah_per_undi
       FROM game_setup
       WHERE kegiatan_id = ?
       ORDER BY id ASC`,
      [kegiatan_id]
    );
    const selectedSetup = (requestedGameId
      ? setupRows.find((setup) => Number(setup.id) === requestedGameId) ?? null
      : null) ?? setupRows[0] ?? null;
    const selectedGameId = selectedSetup ? Number(selectedSetup.id) : null;

    const [winnerRows] = selectedGameId
      ? await pool.execute<RowDataPacket[]>(
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
       FROM game_winners w
       JOIN game_hadiah h ON h.id = w.hadiah_id
       LEFT JOIN anggota a ON a.id = w.anggota_id
       LEFT JOIN presensi_tamu pt ON pt.id = w.tamu_id
       WHERE w.kegiatan_id = ?
         AND w.game_setup_id = ?
       ORDER BY h.urutan ASC`,
      [kegiatan_id, selectedGameId]
    )
      : [[] as RowDataPacket[]];

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
            `UPDATE game_hadiah
             SET urutan = ?,
                 nama_hadiah = CASE
                   WHEN nama_hadiah REGEXP '^(Hadiah|Pemenang|Peserta Terpilih) ke-[0-9]+$' THEN ?
                   ELSE nama_hadiah
                 END
             WHERE id = ?`,
            [urutanBaru, `Peserta Terpilih ke-${urutanBaru}`, winner.hadiah_id]
          );
        })
      );
    }

    const [hadirCount, eligibleCandidates, rollNames] = await Promise.all([
      countGamePresentParticipants(kegiatan_id),
      selectedGameId ? listEligibleGameCandidates(kegiatan_id, selectedGameId) : Promise.resolve([]),
      listHadirAnggotaGameNames(kegiatan_id),
    ]);

    return NextResponse.json({
      kegiatan: kegRows[0],
      setups: setupRows,
      setup: selectedSetup,
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

// PUT /api/game/[kegiatan_id] — upsert setup game
export async function PUT(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    await ensureGameSetupSchema();

    const { kegiatan_id } = await params;
    const body = await req.json();
    const parsedId = Number(body.id);
    const setupId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
    const namaGame = String(body.nama_game ?? "").trim();
    const jumlah = Number(body.jumlah_hadiah);
    const jumlahPerUndi = Number(body.jumlah_per_undi ?? 10);
    if (!namaGame) {
      return NextResponse.json({ error: "Nama game wajib diisi" }, { status: 400 });
    }
    if (!Number.isInteger(jumlah) || jumlah < 1) {
      return NextResponse.json({ error: "Jumlah peserta terpilih tidak valid" }, { status: 400 });
    }
    if (!Number.isInteger(jumlahPerUndi) || jumlahPerUndi < 1) {
      return NextResponse.json({ error: "Jumlah peserta terpilih per pengundian tidak valid" }, { status: 400 });
    }
    if (setupId) {
      const [updateResult] = await pool.execute<ResultSetHeader>(
        `UPDATE game_setup
         SET nama_game = ?, jumlah_hadiah = ?, jumlah_per_undi = ?
         WHERE id = ? AND kegiatan_id = ?`,
        [namaGame, jumlah, jumlahPerUndi, setupId, kegiatan_id]
      );

      if (updateResult.affectedRows === 0) {
        return NextResponse.json({ error: "Setup game tidak ditemukan" }, { status: 404 });
      }

      return NextResponse.json({ id: setupId, nama_game: namaGame, jumlah_hadiah: jumlah, jumlah_per_undi: jumlahPerUndi });
    }

    const [insertResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO game_setup (kegiatan_id, nama_game, jumlah_hadiah, jumlah_per_undi)
       VALUES (?, ?, ?, ?)`,
      [kegiatan_id, namaGame, jumlah, jumlahPerUndi]
    );

    return NextResponse.json({
      id: insertResult.insertId,
      nama_game: namaGame,
      jumlah_hadiah: jumlah,
      jumlah_per_undi: jumlahPerUndi,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan setup" }, { status: 500 });
  }
}

// DELETE /api/game/[kegiatan_id] — reset semua data game kegiatan ini
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ kegiatan_id: string }> }) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    await ensureGameSetupSchema();

    const { kegiatan_id } = await params;
    await pool.execute(`DELETE FROM game_winners WHERE kegiatan_id = ?`, [kegiatan_id]);
    await pool.execute(`DELETE FROM game_hadiah WHERE kegiatan_id = ?`, [kegiatan_id]);
    await pool.execute(`DELETE FROM game_setup WHERE kegiatan_id = ?`, [kegiatan_id]);
    return NextResponse.json({ message: "Data game direset" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mereset data" }, { status: 500 });
  }
}
