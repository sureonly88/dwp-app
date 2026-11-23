CREATE TABLE IF NOT EXISTS kegiatan_petugas (
  kegiatan_id INT UNSIGNED NOT NULL,
  anggota_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (kegiatan_id, anggota_id),
  CONSTRAINT fk_kegiatan_petugas_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
  CONSTRAINT fk_kegiatan_petugas_anggota FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
