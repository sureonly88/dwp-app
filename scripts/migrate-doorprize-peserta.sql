-- Migration: Dukungan peserta doorprize dari anggota hadir maupun tamu hadir

SET @peserta_tipe_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'doorprize_winners'
    AND COLUMN_NAME = 'peserta_tipe'
);
SET @sql = IF(
  @peserta_tipe_exists = 0,
  'ALTER TABLE doorprize_winners ADD COLUMN peserta_tipe ENUM(''anggota'',''tamu'') NOT NULL DEFAULT ''anggota'' AFTER hadiah_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @anggota_nullable = (
  SELECT CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'doorprize_winners'
    AND COLUMN_NAME = 'anggota_id'
  LIMIT 1
);
SET @sql = IF(
  COALESCE(@anggota_nullable, 0) = 0,
  'ALTER TABLE doorprize_winners MODIFY COLUMN anggota_id INT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tamu_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'doorprize_winners'
    AND COLUMN_NAME = 'tamu_id'
);
SET @sql = IF(
  @tamu_id_exists = 0,
  'ALTER TABLE doorprize_winners ADD COLUMN tamu_id INT UNSIGNED NULL AFTER anggota_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE doorprize_winners
SET peserta_tipe = 'anggota'
WHERE anggota_id IS NOT NULL
  AND peserta_tipe <> 'anggota';

SET @idx_tamu_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'doorprize_winners'
    AND INDEX_NAME = 'idx_dp_winners_tamu'
);
SET @sql = IF(
  @idx_tamu_exists = 0,
  'ALTER TABLE doorprize_winners ADD INDEX idx_dp_winners_tamu (tamu_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_tamu_exists = (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'doorprize_winners'
    AND COLUMN_NAME = 'tamu_id'
    AND REFERENCED_TABLE_NAME = 'presensi_tamu'
);
SET @sql = IF(
  @fk_tamu_exists = 0,
  'ALTER TABLE doorprize_winners ADD CONSTRAINT fk_dp_winners_tamu FOREIGN KEY (tamu_id) REFERENCES presensi_tamu(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;