#!/usr/bin/env bash
# migrate.sh — Jalankan semua migration database secara berurutan.
# Gunakan: ./scripts/migrate.sh
# Env vars yang diperlukan: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${DB_USER:?DB_USER environment variable wajib diisi}"
: "${DB_NAME:?DB_NAME environment variable wajib diisi}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"

# Build argumen mysql CLI
build_mysql_args() {
  local args=(-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER")
  if [[ -n "${DB_PASSWORD:-}" ]]; then
    args+=(-p"${DB_PASSWORD}")
  fi
  args+=("$DB_NAME")
  echo "${args[@]}"
}

run_sql() {
  local file="$1"
  echo "[migrate] → $(basename "$file")"
  # shellcheck disable=SC2046
  mysql $(build_mysql_args) < "$file"
}

# ─── Tunggu MySQL siap ────────────────────────────────────────────────────────
echo "[migrate] Menghubungkan ke ${DB_HOST}:${DB_PORT}/${DB_NAME} ..."
MAX_RETRIES=30
for i in $(seq 1 $MAX_RETRIES); do
  # shellcheck disable=SC2046
  if mysql $(build_mysql_args) -e "SELECT 1" &>/dev/null; then
    echo "[migrate] MySQL siap."
    break
  fi
  if [[ $i -eq $MAX_RETRIES ]]; then
    echo "[migrate] ERROR: MySQL tidak dapat dijangkau setelah $MAX_RETRIES percobaan." >&2
    exit 1
  fi
  echo "[migrate] Menunggu MySQL... ($i/$MAX_RETRIES)"
  sleep 2
done

# ─── Jalankan migration (urutan penting!) ────────────────────────────────────
echo "[migrate] Menjalankan migration..."

# 1. Core: unit_kerja dan anggota (harus pertama — tabel lain FK ke anggota)
run_sql "$SCRIPTS_DIR/setup-core.sql"

# 2. Auth users
run_sql "$SCRIPTS_DIR/setup-auth.sql"

# 3. Kegiatan dan presensi
run_sql "$SCRIPTS_DIR/setup-kegiatan.sql"

# 4. Iuran (juga ALTER TABLE anggota add tanggal_keluar)
run_sql "$SCRIPTS_DIR/setup-iuran.sql"

# 5. Arisan & doorprize
run_sql "$SCRIPTS_DIR/setup-undian.sql"

# 6. Presensi tamu
run_sql "$SCRIPTS_DIR/migrate-presensi-tamu.sql"

# 7. Foto presensi tamu
run_sql "$SCRIPTS_DIR/migrate-presensi-tamu-foto.sql"

# 8. Sistem Kas (cash management)
run_sql "$SCRIPTS_DIR/setup-kas.sql"

# 9. Seed data awal (idempotent)
run_sql "$SCRIPTS_DIR/seed.sql"

# 10. Pengaturan organisasi
run_sql "$SCRIPTS_DIR/setup-settings.sql"

echo "[migrate] ✓ Semua migration berhasil dijalankan."
