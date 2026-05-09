-- Migration: Tambahkan kolom foto pada tabel presensi_tamu
ALTER TABLE presensi_tamu ADD COLUMN foto MEDIUMTEXT NULL AFTER keterangan;
