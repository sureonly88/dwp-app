-- Migration: Iuran Anggota DWP
-- Jalankan: mysql --socket=/tmp/mysql.sock -u yakinyakin dwp < scripts/setup-iuran.sql

-- 1) Tambah kolom tanggal_keluar pada tabel anggota (NULL = masih aktif/belum keluar)
SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'anggota'
    AND COLUMN_NAME = 'tanggal_keluar'
);
SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE anggota ADD COLUMN tanggal_keluar DATE NULL AFTER join_date',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Tabel tarif iuran. Tarif berlaku mulai periode_mulai (tanggal 1 bulan tsb).
--    Untuk bulan X, tarif yang dipakai adalah baris dengan periode_mulai terbesar yang <= akhir bulan X
--    DAN aktif = 1.
CREATE TABLE IF NOT EXISTS iuran_tarif (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nominal_anggota DECIMAL(12,2) NOT NULL DEFAULT 0,
  nominal_pengurus DECIMAL(12,2) NOT NULL DEFAULT 0,
  periode_mulai DATE NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  catatan VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_periode (periode_mulai)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed tarif default jika tabel kosong
INSERT INTO iuran_tarif (nominal_anggota, nominal_pengurus, periode_mulai, aktif, catatan)
SELECT 25000, 50000, DATE_FORMAT(CURDATE(), '%Y-%m-01'), 1, 'Tarif awal'
WHERE NOT EXISTS (SELECT 1 FROM iuran_tarif);
