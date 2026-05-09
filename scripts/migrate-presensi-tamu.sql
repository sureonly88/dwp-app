-- Migration: Tambahkan tabel presensi_tamu untuk mencatat kehadiran tamu (non-anggota DWP)
-- Tamu TIDAK ikut dalam pengundian Arisan maupun Doorprize

CREATE TABLE IF NOT EXISTS presensi_tamu (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  kegiatan_id INT UNSIGNED NOT NULL,
  nama VARCHAR(100) NOT NULL,
  instansi VARCHAR(100) NULL COMMENT 'Asal instansi / organisasi tamu (opsional)',
  keterangan VARCHAR(255) NULL COMMENT 'Catatan tambahan (opsional)',
  waktu_hadir TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tamu_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
  INDEX idx_tamu_kegiatan (kegiatan_id),
  INDEX idx_tamu_waktu (waktu_hadir)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Daftar hadir tamu non-anggota DWP. Tidak diikutsertakan dalam arisan/doorprize.';
