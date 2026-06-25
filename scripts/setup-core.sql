-- Migration: Core tables — unit_kerja dan anggota
-- Jalankan PERTAMA sebelum migration lainnya.
-- File ini idempotent (IF NOT EXISTS) — aman dijalankan berulang kali.

-- ─── Unit Kerja ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unit_kerja (
  id          INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  kode        VARCHAR(20)   NOT NULL,
  nama        VARCHAR(100)  NOT NULL,
  deskripsi   TEXT          NULL,
  aktif       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY  uniq_kode     (kode),
  INDEX       idx_unit_kerja_aktif (aktif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Anggota ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anggota (
  id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  nama            VARCHAR(120)  NOT NULL,
  nip             VARCHAR(20)   NOT NULL,
  jabatan         VARCHAR(100)  NOT NULL,
  unit_kerja      VARCHAR(100)  NOT NULL,
  status          ENUM('Aktif','Non-Aktif','Cuti') NOT NULL DEFAULT 'Aktif',
  status_keanggotaan ENUM('Istri Karyawan','Karyawati','Pengurus') NOT NULL DEFAULT 'Istri Karyawan',
  no_hp           VARCHAR(20)   NULL,
  email           VARCHAR(120)  NULL,
  alamat          TEXT          NULL,
  tanggal_lahir   DATE          NULL,
  join_date       DATE          NOT NULL,
  tanggal_keluar  DATE          NULL,
  tanggal_pensiun DATE          NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY  uniq_nip            (nip),
  INDEX       idx_anggota_status  (status),
  INDEX       idx_anggota_status_keanggotaan (status_keanggotaan),
  INDEX       idx_anggota_unit    (unit_kerja)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
