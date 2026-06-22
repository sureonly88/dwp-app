-- Migration: Pengaturan Organisasi
-- Tabel key-value sederhana untuk konfigurasi aplikasi.
-- Idempotent — aman dijalankan berulang kali.

CREATE TABLE IF NOT EXISTS app_settings (
  key_name   VARCHAR(80)   NOT NULL PRIMARY KEY,
  value      TEXT          NULL,
  label      VARCHAR(120)  NULL,
  updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed nilai default (INSERT IGNORE agar tidak overwrite jika sudah ada)
INSERT IGNORE INTO app_settings (key_name, value, label) VALUES
  ('org_name',          'Dharma Wanita Persatuan',                   'Nama Organisasi'),
  ('org_sub_name',      'PT. AIR MINUM BANDARMASIH (PERSERODA)',     'Nama Sub Organisasi / Unit Kerja'),
  ('org_address',       'Jalan A. Yani Km 2,5 No 12 Banjarmasin',   'Alamat Organisasi'),
  ('org_city',          'Banjarmasin',                               'Kota'),
  ('org_timezone',      'Wita',                                      'Zona Waktu Default'),
  ('undangan_kepada',   'Pengurus & Anggota DWP',                   'Default Kepada (Undangan)'),
  ('undangan_jabatan',  'Ketua',                                     'Default Jabatan Penandatangan'),
  ('undangan_nomor_prefix', 'DWP',                                  'Prefix Nomor Surat'),
  ('saldo_awal_arisan_anggota_mei_2026', '0',                       'Saldo Awal Arisan Anggota Mei 2026');
