-- Setup arisan per kegiatan: nominal per orang & jumlah pemenang
CREATE TABLE IF NOT EXISTS arisan_setup (
  kegiatan_id INT UNSIGNED PRIMARY KEY,
  nominal_per_orang DECIMAL(12,2) NOT NULL DEFAULT 0,
  jumlah_pemenang INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_arisan_setup_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pemenang arisan (anggota yang mendapat arisan pada suatu kegiatan)
CREATE TABLE IF NOT EXISTS arisan_winners (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  kegiatan_id INT UNSIGNED NOT NULL,
  anggota_id INT UNSIGNED NOT NULL,
  urutan INT UNSIGNED NOT NULL,
  waktu TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_arisan_winners_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
  CONSTRAINT fk_arisan_winners_anggota FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_arisan_winner (kegiatan_id, anggota_id),
  INDEX idx_arisan_winners_kegiatan (kegiatan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Daftar hadiah doorprize per kegiatan
CREATE TABLE IF NOT EXISTS doorprize_setup (
  kegiatan_id INT NOT NULL,
  jumlah_hadiah INT NOT NULL DEFAULT 1,
  PRIMARY KEY (kegiatan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Detail hadiah doorprize per kegiatan
CREATE TABLE IF NOT EXISTS doorprize_hadiah (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  kegiatan_id INT UNSIGNED NOT NULL,
  nama_hadiah VARCHAR(150) NOT NULL,
  urutan INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doorprize_hadiah_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
  INDEX idx_doorprize_hadiah_kegiatan (kegiatan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pemenang doorprize per hadiah
CREATE TABLE IF NOT EXISTS doorprize_winners (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  kegiatan_id INT UNSIGNED NOT NULL,
  hadiah_id INT UNSIGNED NOT NULL,
  peserta_tipe ENUM('anggota', 'tamu') NOT NULL DEFAULT 'anggota',
  anggota_id INT UNSIGNED NULL,
  tamu_id INT UNSIGNED NULL,
  waktu TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dp_winners_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
  CONSTRAINT fk_dp_winners_hadiah FOREIGN KEY (hadiah_id) REFERENCES doorprize_hadiah(id) ON DELETE CASCADE,
  CONSTRAINT fk_dp_winners_anggota FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE,
  CONSTRAINT fk_dp_winners_tamu FOREIGN KEY (tamu_id) REFERENCES presensi_tamu(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_dp_hadiah_winner (hadiah_id),
  INDEX idx_dp_winners_kegiatan (kegiatan_id),
  INDEX idx_dp_winners_anggota (anggota_id),
  INDEX idx_dp_winners_tamu (tamu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
