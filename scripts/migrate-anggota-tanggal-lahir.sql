SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'anggota'
    AND COLUMN_NAME = 'tanggal_lahir'
);

SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE anggota ADD COLUMN tanggal_lahir DATE NULL AFTER alamat',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;