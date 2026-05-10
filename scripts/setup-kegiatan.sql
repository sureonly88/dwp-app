-- Tabel kegiatan
CREATE TABLE IF NOT EXISTS kegiatan (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  judul VARCHAR(150) NOT NULL,
  deskripsi TEXT NULL,
  tanggal DATE NOT NULL,
  waktu_mulai TIME NULL,
  waktu_selesai TIME NULL,
  lokasi VARCHAR(150) NULL,
  kategori ENUM('Rapat','Sosialisasi','Pelatihan','Arisan','Bakti Sosial','Lainnya') NOT NULL DEFAULT 'Rapat',
  status ENUM('Mendatang','Berlangsung','Selesai','Dibatalkan') NOT NULL DEFAULT 'Mendatang',
  event_code VARCHAR(20) NOT NULL UNIQUE,
  target_peserta INT UNSIGNED NULL,
  unit_kerja_bertugas VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_kegiatan_tanggal (tanggal),
  INDEX idx_kegiatan_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tambah kolom unit_kerja_bertugas jika belum ada (idempotent untuk DB lama)
ALTER TABLE kegiatan
  ADD COLUMN IF NOT EXISTS unit_kerja_bertugas VARCHAR(100) NULL AFTER target_peserta;

-- Tabel presensi (kehadiran)
CREATE TABLE IF NOT EXISTS presensi (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  kegiatan_id INT UNSIGNED NOT NULL,
  anggota_id INT UNSIGNED NOT NULL,
  waktu_hadir TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metode ENUM('QR','Manual') NOT NULL DEFAULT 'QR',
  catatan VARCHAR(255) NULL,
  foto MEDIUMTEXT NULL,
  CONSTRAINT fk_presensi_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
  CONSTRAINT fk_presensi_anggota FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_presensi_anggota (kegiatan_id, anggota_id),
  INDEX idx_presensi_waktu (waktu_hadir)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tambah kolom foto pada presensi jika belum ada (idempotent untuk DB lama)
ALTER TABLE presensi
  ADD COLUMN IF NOT EXISTS foto MEDIUMTEXT NULL AFTER catatan;
