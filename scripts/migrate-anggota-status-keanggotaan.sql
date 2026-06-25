SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'anggota'
    AND COLUMN_NAME = 'status_keanggotaan'
);

SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE anggota ADD COLUMN status_keanggotaan ENUM(''Istri Karyawan'',''Karyawati'',''Pengurus'') NOT NULL DEFAULT ''Istri Karyawan'' AFTER status',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_type = (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'anggota'
    AND COLUMN_NAME = 'status_keanggotaan'
  LIMIT 1
);

SET @sql = IF(
  @column_exists = 1 AND INSTR(LOWER(COALESCE(@column_type, '')), '''pengurus''') = 0,
  'ALTER TABLE anggota MODIFY COLUMN status_keanggotaan ENUM(''Istri Karyawan'',''Karyawati'',''Pengurus'') NOT NULL DEFAULT ''Istri Karyawan''',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'anggota'
    AND INDEX_NAME = 'idx_anggota_status_keanggotaan'
);

SET @sql = IF(
  @index_exists = 0,
  'ALTER TABLE anggota ADD INDEX idx_anggota_status_keanggotaan (status_keanggotaan)',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;