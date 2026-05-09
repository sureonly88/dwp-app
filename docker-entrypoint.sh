#!/bin/sh
# docker-entrypoint.sh — Jalankan migrasi database lalu start aplikasi.
set -e

echo "[entrypoint] Menjalankan migrasi database..."
/app/scripts/migrate.sh

echo "[entrypoint] Memulai aplikasi..."
exec "$@"
