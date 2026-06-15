-- ============================================================================
-- setup-kas.sql — Sistem Kas (cash management) untuk DWP
--
-- Tabel:
--   cash_categories   : kategori pemasukan & pengeluaran
--   cash_transactions : seluruh transaksi (manual & otomatis dari modul lain)
--   sales             : header penjualan barang
--   sale_items        : detail item per penjualan
-- ============================================================================

-- 1. Kategori kas -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(120) NOT NULL,
  type        ENUM('income','expense') NOT NULL,
  is_system   TINYINT(1)   NOT NULL DEFAULT 0,
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  description VARCHAR(255) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cash_cat_code (code),
  KEY idx_cash_cat_type (type, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Transaksi kas ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_transactions (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_number  VARCHAR(40)  NOT NULL,
  transaction_date    DATE         NOT NULL,
  type                ENUM('income','expense') NOT NULL,
  category_id         INT UNSIGNED NOT NULL,
  amount              DECIMAL(14,2) NOT NULL,
  payment_method      ENUM('Tunai','Transfer','QRIS','Lainnya') NOT NULL DEFAULT 'Tunai',
  description         VARCHAR(255) NULL,
  reference_number    VARCHAR(80)  NULL,
  attachment_url      VARCHAR(500) NULL,
  status              ENUM('draft','pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  source_type         VARCHAR(40)  NULL,    -- 'iuran_anggota' | 'iuran_pengurus' | 'sale' | 'manual' | ...
  source_id           VARCHAR(80)  NULL,    -- e.g. '2026-05' for iuran rekap, sale.id for sale
  source_fund         VARCHAR(40)  NULL,    -- 'umum' | 'iuran_anggota' | 'iuran_konsumsi_anggota' | 'iuran_pengurus'
  notes              VARCHAR(500) NULL,
  created_by          INT UNSIGNED NULL,
  approved_by         INT UNSIGNED NULL,
  approved_at         TIMESTAMP    NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cash_trx_number (transaction_number),
  -- Cegah duplikasi posting otomatis
  UNIQUE KEY uniq_cash_trx_source (source_type, source_id),
  KEY idx_cash_trx_date (transaction_date),
  KEY idx_cash_trx_status_type (status, type),
  KEY idx_cash_trx_source_fund (source_fund),
  KEY idx_cash_trx_category (category_id),
  CONSTRAINT fk_cash_trx_category FOREIGN KEY (category_id) REFERENCES cash_categories(id),
  CONSTRAINT fk_cash_trx_created_by FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_cash_trx_approved_by FOREIGN KEY (approved_by) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Penjualan barang ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_number     VARCHAR(40)  NOT NULL,
  sale_date       DATE         NOT NULL,
  buyer_name      VARCHAR(120) NULL,
  payment_method  ENUM('Tunai','Transfer','QRIS','Lainnya') NOT NULL DEFAULT 'Tunai',
  total_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes           VARCHAR(500) NULL,
  posted_to_kas   TINYINT(1)   NOT NULL DEFAULT 0,
  cash_trx_id     INT UNSIGNED NULL,
  created_by      INT UNSIGNED NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sale_number (sale_number),
  KEY idx_sale_date (sale_date),
  CONSTRAINT fk_sale_cash_trx FOREIGN KEY (cash_trx_id) REFERENCES cash_transactions(id) ON DELETE SET NULL,
  CONSTRAINT fk_sale_created_by FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sale_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id     INT UNSIGNED NOT NULL,
  item_name   VARCHAR(160) NOT NULL,
  quantity    DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price  DECIMAL(14,2) NOT NULL DEFAULT 0,
  subtotal    DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sale_items_sale (sale_id),
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Seed kategori default (idempotent) --------------------------------------
INSERT IGNORE INTO cash_categories (code, name, type, is_system, description) VALUES
  ('IURAN_ANGGOTA',     'Iuran Arisan Anggota',   'income',  1, 'Posting rekap iuran arisan anggota dari modul Iuran'),
  ('IURAN_KONSUMSI_ANGGOTA', 'Iuran Konsumsi Anggota', 'income', 1, 'Posting rekap iuran konsumsi anggota dari modul Iuran'),
  ('IURAN_PENGURUS',    'Iuran Pengurus',         'income',  1, 'Posting rekap iuran pengurus dari modul Iuran'),
  ('PENJUALAN_BARANG',  'Penjualan Barang',       'income',  1, 'Otomatis dari modul Penjualan'),
  ('DONASI',            'Donasi',                 'income',  0, 'Sumbangan dari donatur'),
  ('PEMASUKAN_LAIN',    'Pemasukan Lain-lain',    'income',  0, 'Pemasukan tidak terkategori'),
  ('KEGIATAN',          'Biaya Kegiatan',         'expense', 0, 'Pengeluaran terkait kegiatan'),
  ('OPERASIONAL',       'Operasional',            'expense', 0, 'ATK, listrik, internet, dll'),
  ('PEMBELIAN_BARANG',  'Pembelian Barang',       'expense', 0, 'Pembelian inventaris/perlengkapan'),
  ('ARISAN_ANGGOTA',    'Arisan Anggota',         'expense', 0, 'Pengeluaran untuk dana arisan anggota'),
  ('ARISAN_PENGURUS',   'Arisan Pengurus',        'expense', 0, 'Pengeluaran untuk dana arisan pengurus'),
  ('BANTUAN_SOSIAL',    'Bantuan Sosial',         'expense', 0, 'Bantuan ke anggota / masyarakat'),
  ('KONSUMSI',          'Konsumsi',               'expense', 0, 'Konsumsi rapat / kegiatan'),
  ('PENGELUARAN_LAIN',  'Pengeluaran Lain-lain',  'expense', 0, 'Pengeluaran tidak terkategori');
