import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { ensureAnggotaSchema } from "@/lib/anggota";
import { PRESENSI_NON_PETUGAS_SQL } from "@/lib/kegiatan-petugas";

export type GamePesertaTipe = "anggota" | "tamu";

const GAME_PRESENT_MEMBERS_SQL = `
  FROM anggota a
  INNER JOIN presensi pr ON pr.anggota_id = a.id
  WHERE pr.kegiatan_id = ?
    AND a.status_keanggotaan IN ('Istri Karyawan', 'Karyawati')
    AND ${PRESENSI_NON_PETUGAS_SQL}
`;

export const GAME_ELIGIBLE_MEMBERS_SQL = `
  ${GAME_PRESENT_MEMBERS_SQL}
    AND a.id NOT IN (
      SELECT anggota_id
      FROM game_winners
      WHERE kegiatan_id = ?
        AND game_setup_id = ?
        AND anggota_id IS NOT NULL
    )
`;

let ensureGameSetupSchemaPromise: Promise<void> | null = null;

interface GameCandidateRow extends RowDataPacket {
  peserta_tipe: GamePesertaTipe;
  anggota_id: number | null;
  tamu_id: number | null;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  unit_kerja: string | null;
  instansi: string | null;
}

export interface GameCandidate {
  peserta_tipe: GamePesertaTipe;
  anggota_id: number | null;
  tamu_id: number | null;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  unit_kerja: string | null;
  instansi: string | null;
}

export async function ensureGameSetupSchema() {
  if (!ensureGameSetupSchemaPromise) {
    ensureGameSetupSchemaPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS game_setup (
          id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
          kegiatan_id INT UNSIGNED NOT NULL,
          nama_game VARCHAR(150) NOT NULL DEFAULT 'Game',
          jumlah_hadiah INT NOT NULL DEFAULT 1,
          jumlah_per_undi INT NOT NULL DEFAULT 10,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_game_setup_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
          INDEX idx_game_setup_kegiatan (kegiatan_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS game_hadiah (
          id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
          kegiatan_id INT UNSIGNED NOT NULL,
          game_setup_id INT UNSIGNED NULL,
          nama_hadiah VARCHAR(150) NOT NULL,
          urutan INT UNSIGNED NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_game_hadiah_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
          CONSTRAINT fk_game_hadiah_setup FOREIGN KEY (game_setup_id) REFERENCES game_setup(id) ON DELETE CASCADE,
          INDEX idx_game_hadiah_setup (game_setup_id),
          INDEX idx_game_hadiah_kegiatan (kegiatan_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS game_winners (
          id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
          kegiatan_id INT UNSIGNED NOT NULL,
          game_setup_id INT UNSIGNED NULL,
          hadiah_id INT UNSIGNED NOT NULL,
          peserta_tipe ENUM('anggota', 'tamu') NOT NULL DEFAULT 'anggota',
          anggota_id INT UNSIGNED NULL,
          tamu_id INT UNSIGNED NULL,
          waktu TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_game_winners_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
          CONSTRAINT fk_game_winners_setup FOREIGN KEY (game_setup_id) REFERENCES game_setup(id) ON DELETE CASCADE,
          CONSTRAINT fk_game_winners_hadiah FOREIGN KEY (hadiah_id) REFERENCES game_hadiah(id) ON DELETE CASCADE,
          CONSTRAINT fk_game_winners_anggota FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE,
          CONSTRAINT fk_game_winners_tamu FOREIGN KEY (tamu_id) REFERENCES presensi_tamu(id) ON DELETE CASCADE,
          UNIQUE KEY uniq_game_hadiah_winner (hadiah_id),
          INDEX idx_game_winners_setup (game_setup_id),
          INDEX idx_game_winners_kegiatan (kegiatan_id),
          INDEX idx_game_winners_anggota (anggota_id),
          INDEX idx_game_winners_tamu (tamu_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const [idRows] = await pool.execute<RowDataPacket[]>(
        `SHOW COLUMNS FROM game_setup LIKE 'id'`
      );

      if (!idRows.length) {
        await pool.execute(
          `ALTER TABLE game_setup ADD COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE FIRST`
        );
      }

      const [primaryRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'game_setup'
           AND CONSTRAINT_NAME = 'PRIMARY'
         ORDER BY ORDINAL_POSITION`
      );

      if (primaryRows.some((row) => row.COLUMN_NAME === "kegiatan_id")) {
        await pool.execute(`ALTER TABLE game_setup DROP PRIMARY KEY, ADD PRIMARY KEY (id)`);
      }

      const [namaGameRows] = await pool.execute<RowDataPacket[]>(
        `SHOW COLUMNS FROM game_setup LIKE 'nama_game'`
      );

      if (!namaGameRows.length) {
        await pool.execute(
          `ALTER TABLE game_setup ADD COLUMN nama_game VARCHAR(150) NOT NULL DEFAULT 'Game' AFTER kegiatan_id`
        );
      }

      const [rows] = await pool.execute<RowDataPacket[]>(
        `SHOW COLUMNS FROM game_setup LIKE 'jumlah_per_undi'`
      );

      if (!rows.length) {
        await pool.execute(
          `ALTER TABLE game_setup ADD COLUMN jumlah_per_undi INT NOT NULL DEFAULT 10 AFTER jumlah_hadiah`
        );
      }

      await ensureColumn("game_hadiah", "game_setup_id", "ADD COLUMN game_setup_id INT UNSIGNED NULL AFTER kegiatan_id");
      await ensureColumn("game_winners", "game_setup_id", "ADD COLUMN game_setup_id INT UNSIGNED NULL AFTER kegiatan_id");
      await ensureIndex("game_setup", "idx_game_setup_kegiatan", "ADD INDEX idx_game_setup_kegiatan (kegiatan_id)");
      await ensureIndex("game_hadiah", "idx_game_hadiah_setup", "ADD INDEX idx_game_hadiah_setup (game_setup_id)");
      await ensureIndex("game_winners", "idx_game_winners_setup", "ADD INDEX idx_game_winners_setup (game_setup_id)");

      await pool.execute(`
        UPDATE game_hadiah h
        JOIN game_setup gs ON gs.kegiatan_id = h.kegiatan_id
        SET h.game_setup_id = gs.id
        WHERE h.game_setup_id IS NULL
      `);
      await pool.execute(`
        UPDATE game_winners w
        JOIN game_hadiah h ON h.id = w.hadiah_id
        SET w.game_setup_id = h.game_setup_id
        WHERE w.game_setup_id IS NULL
      `);

      await ensureForeignKey("game_hadiah", "fk_game_hadiah_setup", "game_setup_id", "game_setup", "id");
      await ensureForeignKey("game_winners", "fk_game_winners_setup", "game_setup_id", "game_setup", "id");
    })().catch((error) => {
      ensureGameSetupSchemaPromise = null;
      throw error;
    });
  }

  await ensureGameSetupSchemaPromise;
}

async function ensureColumn(table: string, column: string, alterSql: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );

  if (Number(rows[0]?.count ?? 0) === 0) {
    await pool.execute(`ALTER TABLE ${table} ${alterSql}`);
  }
}

async function ensureIndex(table: string, indexName: string, alterSql: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [table, indexName]
  );

  if (Number(rows[0]?.count ?? 0) === 0) {
    await pool.execute(`ALTER TABLE ${table} ${alterSql}`);
  }
}

async function ensureForeignKey(
  table: string,
  constraintName: string,
  column: string,
  referencedTable: string,
  referencedColumn: string
) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [table, constraintName]
  );

  if (Number(rows[0]?.count ?? 0) === 0) {
    await pool.execute(
      `ALTER TABLE ${table}
       ADD CONSTRAINT ${constraintName}
       FOREIGN KEY (${column}) REFERENCES ${referencedTable}(${referencedColumn})
       ON DELETE CASCADE`
    );
  }
}

export async function listHadirAnggotaGameNames(kegiatanId: number | string): Promise<string[]> {
  await ensureAnggotaSchema();

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT a.nama ${GAME_PRESENT_MEMBERS_SQL}
       AND COALESCE(NULLIF(TRIM(a.nama), ''), '') <> ''
     ORDER BY a.nama ASC`,
    [kegiatanId]
  );

  return rows
    .map((row) => String(row.nama ?? "").trim())
    .filter(Boolean);
}

export async function listEligibleGameCandidates(
  kegiatanId: number | string,
  gameSetupId: number | string
): Promise<GameCandidate[]> {
  await ensureAnggotaSchema();

  const [rows] = await pool.execute<GameCandidateRow[]>(
    `SELECT 'anggota' AS peserta_tipe,
            a.id AS anggota_id,
            NULL AS tamu_id,
            a.nama,
            a.nip,
            a.jabatan,
            a.unit_kerja,
            NULL AS instansi
     ${GAME_ELIGIBLE_MEMBERS_SQL}`,
    [kegiatanId, kegiatanId, gameSetupId]
  );

  return rows.map((row) => ({
    peserta_tipe: row.peserta_tipe,
    anggota_id: row.anggota_id ? Number(row.anggota_id) : null,
    tamu_id: row.tamu_id ? Number(row.tamu_id) : null,
    nama: row.nama,
    nip: row.nip,
    jabatan: row.jabatan,
    unit_kerja: row.unit_kerja,
    instansi: row.instansi,
  }));
}

export async function pickRandomGameCandidate(
  kegiatanId: number | string,
  gameSetupId: number | string
): Promise<GameCandidate | null> {
  const candidates = await listEligibleGameCandidates(kegiatanId, gameSetupId);
  if (candidates.length === 0) return null;

  const pickedIndex = Math.floor(Math.random() * candidates.length);
  return candidates[pickedIndex] ?? null;
}

export async function countGamePresentParticipants(kegiatanId: number | string): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT (
        SELECT COUNT(DISTINCT pr.anggota_id)
        FROM presensi pr
        WHERE pr.kegiatan_id = ?
      ) + (
        SELECT COUNT(*)
        FROM presensi_tamu
        WHERE kegiatan_id = ?
      ) AS hadir_count`,
    [kegiatanId, kegiatanId]
  );

  return Number(rows[0]?.hadir_count ?? 0);
}
