SET @db_name = DATABASE();

SET @source_fund_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'cash_transactions'
    AND COLUMN_NAME = 'source_fund'
);

SET @add_source_fund_sql = IF(
  @source_fund_exists = 0,
  'ALTER TABLE cash_transactions ADD COLUMN source_fund VARCHAR(40) NULL AFTER source_id',
  'SELECT 1'
);
PREPARE stmt FROM @add_source_fund_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE cash_transactions
SET source_fund = 'umum'
WHERE type = 'expense'
  AND (source_fund IS NULL OR source_fund = '');