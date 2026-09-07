-- Migration: Tambah jumlah pemenang doorprize per satu kali pengundian

SET @jumlah_per_undi_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'doorprize_setup'
    AND COLUMN_NAME = 'jumlah_per_undi'
);
SET @sql = IF(
  @jumlah_per_undi_exists = 0,
  'ALTER TABLE doorprize_setup ADD COLUMN jumlah_per_undi INT NOT NULL DEFAULT 10 AFTER jumlah_hadiah',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
