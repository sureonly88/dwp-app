# Panduan Deploy ke Dokploy

## Prasyarat

- Server dengan Dokploy terinstall
- Akses ke repositori Git (GitHub/GitLab/Gitea)
- Domain/subdomain yang sudah diarahkan ke server

---

## Option A — Docker Compose (App + MySQL dalam satu stack)

Gunakan opsi ini jika ingin MySQL dikelola oleh Dokploy sebagai container.

### 1. Siapkan environment variables

Di panel Dokploy → Environment, isi variabel berikut (lihat `.env.example`):

```env
DB_HOST=db
DB_PORT=3306
DB_USER=dwpuser
DB_PASSWORD=<password_db_yang_kuat>
DB_NAME=dwp
MYSQL_ROOT_PASSWORD=<password_root_yang_kuat>
AUTH_SECRET=<string_random_minimal_32_karakter>
APP_PORT=3000
```

Generate `AUTH_SECRET`:
```bash
openssl rand -hex 32
```

### 2. Buat service di Dokploy

1. Dokploy → **Create Service** → pilih **Docker Compose**
2. Hubungkan ke repositori Git
3. Set **Compose File** ke `docker-compose.yml`
4. Isi environment variables (langkah 1)
5. Klik **Deploy**

### 3. Apa yang terjadi saat deploy

1. Docker build image dari `Dockerfile` (3-stage: deps → builder → runner)
2. Container `db` (MySQL 8.0) start, menunggu hingga healthy
3. Container `app` start → `docker-entrypoint.sh` dijalankan:
   - `migrate.sh` — menjalankan semua migration SQL secara berurutan
   - Seed data awal (unit kerja, 1 anggota, 1 user admin)
   - `node server.js` — Next.js production server berjalan

---

## Option B — App saja + Dokploy Managed Database

Gunakan opsi ini jika ingin menggunakan fitur Database bawaan Dokploy.

### 1. Buat Database di Dokploy

1. Dokploy → **Create Service** → pilih **Database** → **MySQL 8.0**
2. Isi nama database, user, dan password
3. Catat: **Host**, **Port**, **Database name**, **User**, **Password**

### 2. Buat Application service

1. Dokploy → **Create Service** → pilih **Application**
2. Hubungkan ke repositori Git
3. Set **Build Type** ke `Dockerfile`
4. Isi environment variables:

```env
DB_HOST=<host_dari_dokploy_managed_db>
DB_PORT=<port_dari_dokploy_managed_db>
DB_USER=<user_db>
DB_PASSWORD=<password_db>
DB_NAME=<nama_database>
AUTH_SECRET=<string_random_minimal_32_karakter>
```

5. Klik **Deploy**

---

## Urutan Migration Database

Migration dijalankan otomatis oleh `scripts/migrate.sh` saat container pertama kali start.
Urutan eksekusi:

| # | File | Isi |
|---|------|-----|
| 1 | `setup-core.sql` | Tabel `unit_kerja` dan `anggota` |
| 2 | `setup-auth.sql` | Tabel `auth_users` |
| 3 | `setup-kegiatan.sql` | Tabel `kegiatan` dan `presensi` |
| 4 | `setup-iuran.sql` | Tabel `iuran_tarif`, ALTER `anggota` tambah `tanggal_keluar` |
| 5 | `setup-undian.sql` | Tabel `arisan_setup`, `arisan_winners`, `doorprize_*` |
| 6 | `migrate-presensi-tamu.sql` | Tabel `presensi_tamu` |
| 7 | `migrate-presensi-tamu-foto.sql` | ALTER `presensi_tamu` tambah kolom `foto` |
| 8 | `seed.sql` | Seed: 1 unit kerja, 1 anggota, 1 user admin |

Semua file idempotent (`IF NOT EXISTS`, `WHERE NOT EXISTS`) — aman dijalankan ulang.

---

## Login Pertama

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

> **⚠️ WAJIB ganti password admin segera setelah deploy pertama!**

---

## Ganti Password Admin

### Via UI

Masuk sebagai admin → menu **Manajemen User** → edit user admin → ganti password.

### Generate hash manual (jika perlu set lewat env/SQL)

```bash
node -e "
  const c = require('crypto');
  const s = c.randomBytes(16).toString('base64url');
  const h = c.scryptSync('PASSWORD_BARU_ANDA', s, 64).toString('base64url');
  console.log('scrypt:' + s + ':' + h);
"
```

Set hasil output ke env var `DWP_SEED_ADMIN_PASSWORD_HASH` sebelum deploy pertama
agar seed langsung pakai password yang sudah diganti.

---

## Kustomisasi Data Seed Awal

Edit `scripts/seed.sql` sebelum deploy pertama untuk menyesuaikan:
- Nama unit kerja default
- Data anggota contoh (nama, NIP, jabatan)

---

## Re-deploy (Update Aplikasi)

Cukup push kode ke Git → Dokploy otomatis build dan deploy ulang.
Migration berjalan lagi saat container start — tidak akan duplikat data karena idempotent.

---

## Troubleshooting

**Migration gagal saat startup:**
- Cek log container di Dokploy → Logs
- Pastikan variabel `DB_*` sudah benar
- Pastikan MySQL sudah healthy sebelum app start (lihat `healthcheck` di `docker-compose.yml`)

**Puppeteer / generate PDF gagal:**
- Chromium diinstall di container secara otomatis (`/usr/bin/chromium`)
- Env `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` sudah diset di Dockerfile

**Port konflik:**
- Default port app: `3000`
- Set `APP_PORT` di env untuk menggantinya
