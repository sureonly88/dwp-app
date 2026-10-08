-- Setup game per kegiatan: nama game, kuota peserta terpilih, dan jumlah peserta terpilih per undian
CREATE TABLE IF NOT EXISTS game_setup (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  kegiatan_id INT UNSIGNED NOT NULL,
  nama_game VARCHAR(150) NOT NULL DEFAULT 'Game',
  jumlah_hadiah INT NOT NULL DEFAULT 1,
  jumlah_per_undi INT NOT NULL DEFAULT 10,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_game_setup_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
  INDEX idx_game_setup_kegiatan (kegiatan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Slot peserta terpilih game per kegiatan
CREATE TABLE IF NOT EXISTS game_hadiah (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  kegiatan_id INT UNSIGNED NOT NULL,
  game_setup_id INT UNSIGNED NULL,
  nama_hadiah VARCHAR(150) NOT NULL,
  urutan INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_game_hadiah_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_hadiah_setup FOREIGN KEY (game_setup_id) REFERENCES game_setup(id) ON DELETE CASCADE,
  INDEX idx_game_hadiah_setup (game_setup_id),
  INDEX idx_game_hadiah_kegiatan (kegiatan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Peserta Terpilih game
CREATE TABLE IF NOT EXISTS game_winners (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  kegiatan_id INT UNSIGNED NOT NULL,
  game_setup_id INT UNSIGNED NULL,
  hadiah_id INT UNSIGNED NOT NULL,
  peserta_tipe ENUM('anggota', 'tamu') NOT NULL DEFAULT 'anggota',
  anggota_id INT UNSIGNED NULL,
  tamu_id INT UNSIGNED NULL,
  waktu TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_game_winners_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_winners_setup FOREIGN KEY (game_setup_id) REFERENCES game_setup(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_winners_hadiah FOREIGN KEY (hadiah_id) REFERENCES game_hadiah(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_winners_anggota FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_winners_tamu FOREIGN KEY (tamu_id) REFERENCES presensi_tamu(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_game_hadiah_winner (hadiah_id),
  INDEX idx_game_winners_setup (game_setup_id),
  INDEX idx_game_winners_kegiatan (kegiatan_id),
  INDEX idx_game_winners_anggota (anggota_id),
  INDEX idx_game_winners_tamu (tamu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
