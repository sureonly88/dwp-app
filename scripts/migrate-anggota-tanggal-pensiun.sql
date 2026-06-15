SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'anggota'
    AND COLUMN_NAME = 'tanggal_pensiun'
);

SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE anggota ADD COLUMN tanggal_pensiun DATE NULL AFTER tanggal_keluar',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;