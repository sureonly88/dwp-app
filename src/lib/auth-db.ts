import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { UserRole } from "./auth-token";

const DEFAULT_ADMIN_HASH = "scrypt:ym4JvCqA7cYURiPkEcpw1w:MSScQ06P69hPRJTcAYqPn_P3I307LwctzBdV5Fk6_43JumX8Ls469VE2PWEDTO89FUA2penXA73m46BvFuYYgA";

export interface AuthUserRow extends RowDataPacket {
  id: number;
  username: string;
  nama: string;
  password_hash: string;
  role: UserRole;
  aktif: number;
  anggota_id: number | null;
}

export interface AuthUserDetail extends RowDataPacket {
  id: number;
  username: string;
  nama: string;
  role: UserRole;
  aktif: number;
  anggota_id: number | null;
  anggota_nama: string | null;
  anggota_nip: string | null;
  anggota_unit_kerja: string | null;
  last_login_at: string | null;
  created_at: string;
}

export async function ensureAuthSchema() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(60) NOT NULL UNIQUE,
      nama VARCHAR(120) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','operator','viewer') NOT NULL DEFAULT 'viewer',
      aktif TINYINT(1) NOT NULL DEFAULT 1,
      anggota_id INT UNSIGNED NULL DEFAULT NULL,
      last_login_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_auth_users_role (role),
      INDEX idx_auth_users_aktif (aktif)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Add anggota_id column if table already existed without it
  await pool.execute(`
    ALTER TABLE auth_users
    ADD COLUMN IF NOT EXISTS anggota_id INT UNSIGNED NULL DEFAULT NULL
  `).catch(() => {/* column may already exist */});

  await pool.execute(
    `INSERT INTO auth_users (username, nama, password_hash, role, aktif)
     SELECT 'admin', 'Administrator DWP', ?, 'admin', 1
     WHERE NOT EXISTS (SELECT 1 FROM auth_users WHERE username = 'admin')`,
    [process.env.DWP_SEED_ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_HASH]
  );
}

export async function findActiveUserByUsername(username: string) {
  await ensureAuthSchema();
  const [rows] = await pool.execute<AuthUserRow[]>(
    `SELECT id, username, nama, password_hash, role, aktif, anggota_id
     FROM auth_users
     WHERE username = ? AND aktif = 1
     LIMIT 1`,
    [username]
  );
  return rows[0] ?? null;
}

export async function touchLastLogin(userId: number) {
  await pool.execute("UPDATE auth_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [userId]);
}

// ─── User Management ────────────────────────────────────────────────────────

export async function listUsers(search = "") {
  await ensureAuthSchema();
  const param = search ? `%${search}%` : "%";
  const [rows] = await pool.execute<AuthUserDetail[]>(
    `SELECT u.id, u.username, u.nama, u.role, u.aktif, u.anggota_id,
            a.nama AS anggota_nama, a.nip AS anggota_nip, a.unit_kerja AS anggota_unit_kerja,
            u.last_login_at, u.created_at
     FROM auth_users u
     LEFT JOIN anggota a ON a.id = u.anggota_id
     WHERE u.username LIKE ? OR u.nama LIKE ?
     ORDER BY u.created_at DESC`,
    [param, param]
  );
  return rows;
}

export async function getUserById(id: number) {
  await ensureAuthSchema();
  const [rows] = await pool.execute<AuthUserDetail[]>(
    `SELECT u.id, u.username, u.nama, u.role, u.aktif, u.anggota_id,
            a.nama AS anggota_nama, a.nip AS anggota_nip, a.unit_kerja AS anggota_unit_kerja,
            u.last_login_at, u.created_at
     FROM auth_users u
     LEFT JOIN anggota a ON a.id = u.anggota_id
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getAuthUserById(id: number) {
  await ensureAuthSchema();
  const [rows] = await pool.execute<AuthUserRow[]>(
    `SELECT id, username, nama, password_hash, role, aktif, anggota_id
     FROM auth_users
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createUser(data: {
  username: string;
  nama: string;
  password_hash: string;
  role: UserRole;
  aktif: number;
  anggota_id: number | null;
}) {
  await ensureAuthSchema();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO auth_users (username, nama, password_hash, role, aktif, anggota_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.username, data.nama, data.password_hash, data.role, data.aktif, data.anggota_id]
  );
  return result.insertId;
}

export async function updateUser(
  id: number,
  data: {
    username?: string;
    nama?: string;
    password_hash?: string;
    role?: UserRole;
    aktif?: number;
    anggota_id?: number | null;
  }
) {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (data.username !== undefined) { fields.push("username = ?"); params.push(data.username); }
  if (data.nama !== undefined) { fields.push("nama = ?"); params.push(data.nama); }
  if (data.password_hash !== undefined) { fields.push("password_hash = ?"); params.push(data.password_hash); }
  if (data.role !== undefined) { fields.push("role = ?"); params.push(data.role); }
  if (data.aktif !== undefined) { fields.push("aktif = ?"); params.push(data.aktif); }
  if ("anggota_id" in data) { fields.push("anggota_id = ?"); params.push(data.anggota_id ?? null); }

  if (fields.length === 0) return;
  params.push(id);
  await pool.execute(`UPDATE auth_users SET ${fields.join(", ")} WHERE id = ?`, params as (string | number | null)[]);
}

export async function deleteUser(id: number) {
  await pool.execute("DELETE FROM auth_users WHERE id = ?", [id]);
}
