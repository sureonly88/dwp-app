-- Migration: Tambah jumlah pemenang arisan per satu kali pengundian

SET @jumlah_per_undi_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'arisan_setup'
    AND COLUMN_NAME = 'jumlah_per_undi'
);
SET @sql = IF(
  @jumlah_per_undi_exists = 0,
  'ALTER TABLE arisan_setup ADD COLUMN jumlah_per_undi INT UNSIGNED NOT NULL DEFAULT 10 AFTER jumlah_pemenang',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
