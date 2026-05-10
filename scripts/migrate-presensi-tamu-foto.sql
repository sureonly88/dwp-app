-- Migration: Tambahkan kolom foto pada tabel presensi_tamu
SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'presensi_tamu'
    AND COLUMN_NAME = 'foto'
);
SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE presensi_tamu ADD COLUMN foto MEDIUMTEXT NULL AFTER keterangan',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
