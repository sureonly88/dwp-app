-- Seed: Data awal untuk deploy pertama.
-- File ini idempotent — aman dijalankan berulang kali (INSERT ... WHERE NOT EXISTS).

-- ─── 1. Unit Kerja awal ────────────────────────────────────────────────────────
INSERT INTO unit_kerja (kode, nama, deskripsi)
SELECT 'SEKRETARIAT', 'Sekretariat', 'Unit Kerja Sekretariat DWP'
WHERE NOT EXISTS (SELECT 1 FROM unit_kerja LIMIT 1);

-- ─── 2. Anggota contoh ────────────────────────────────────────────────────────
-- Ubah data ini sesuai kebutuhan sebelum deploy pertama.
INSERT INTO anggota (nama, nip, jabatan, unit_kerja, status, status_keanggotaan, join_date)
SELECT
  'Admin DWP',
  '000000000001',
  'Ketua',
  'Sekretariat',
  'Aktif',
  'Istri Karyawan',
  CURDATE()
WHERE NOT EXISTS (SELECT 1 FROM anggota LIMIT 1);

-- ─── 3. User admin ────────────────────────────────────────────────────────────
-- Password default: admin123
-- !! WAJIB GANTI PASSWORD SETELAH DEPLOY PERTAMA !!
-- Untuk generate hash password baru, jalankan di server:
--   node -e "
--     const c=require('crypto');
--     const s=c.randomBytes(16).toString('base64url');
--     const h=c.scryptSync('PASSWORD_BARU',s,64).toString('base64url');
--     console.log('scrypt:'+s+':'+h);
--   "
INSERT INTO auth_users (username, nama, password_hash, role, aktif)
SELECT
  'admin',
  'Administrator DWP',
  'scrypt:ym4JvCqA7cYURiPkEcpw1w:MSScQ06P69hPRJTcAYqPn_P3I307LwctzBdV5Fk6_43JumX8Ls469VE2PWEDTO89FUA2penXA73m46BvFuYYgA',
  'admin',
  1
WHERE NOT EXISTS (SELECT 1 FROM auth_users WHERE username = 'admin');
