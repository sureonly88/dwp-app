-- Migration: Auth users & roles
-- Default login setelah migration:
--   username: admin
--   password: admin123
-- Ganti password segera setelah setup produksi.

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tambahkan kolom anggota_id jika tabel sudah ada tanpa kolom ini
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS anggota_id INT UNSIGNED NULL DEFAULT NULL AFTER aktif;

-- Seed user admin default (password: admin123) — ganti setelah deploy pertama!
-- Hash ini di-generate menggunakan lib/password.ts hashPassword("admin123")
INSERT INTO auth_users (username, nama, password_hash, role, aktif)
SELECT
  'admin',
  'Administrator DWP',
  'scrypt:ym4JvCqA7cYURiPkEcpw1w:MSScQ06P69hPRJTcAYqPn_P3I307LwctzBdV5Fk6_43JumX8Ls469VE2PWEDTO89FUA2penXA73m46BvFuYYgA',
  'admin',
  1
WHERE NOT EXISTS (SELECT 1 FROM auth_users WHERE username = 'admin');
