import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import puppeteer from "puppeteer";
import { requireAdmin } from "@/lib/admin-auth";

const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatTanggalPanjang(dateStr: string) {
  const date = new Date(dateStr);
  return `${HARI_ID[date.getDay()]}, ${String(date.getDate()).padStart(2, "0")} ${BULAN_ID[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTanggalJam(dateStr: string) {
  const date = new Date(dateStr);
  const jam = String(date.getHours()).padStart(2, "0");
  const menit = String(date.getMinutes()).padStart(2, "0");
  return `${String(date.getDate()).padStart(2, "0")} ${BULAN_ID[date.getMonth()]} ${date.getFullYear()} ${jam}:${menit}`;
}

type KegiatanRow = RowDataPacket & {
  id: number;
  judul: string;
  tanggal: string;
  lokasi: string | null;
  event_code: string;
};

type SetupRow = RowDataPacket & {
  jumlah_hadiah: number;
};

type WinnerRow = RowDataPacket & {
  id: number;
  urutan: number;
  peserta_tipe: "anggota" | "tamu";
  nama: string;
  nip: string | null;
  jabatan: string | null;
  unit_kerja: string | null;
  instansi: string | null;
  waktu: string;
};

// GET /api/doorprize/[kegiatan_id]/pdf
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kegiatan_id: string }> }
) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  try {
    const { kegiatan_id } = await params;

    const [kegiatanRows] = await pool.execute<KegiatanRow[]>(
      `SELECT id, judul, tanggal, lokasi, event_code
       FROM kegiatan
       WHERE id = ?
       LIMIT 1`,
      [kegiatan_id]
    );

    if (kegiatanRows.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }

    const [setupRows] = await pool.execute<SetupRow[]>(
      `SELECT jumlah_hadiah
       FROM doorprize_setup
       WHERE kegiatan_id = ?
       LIMIT 1`,
      [kegiatan_id]
    );

    const [winnerRows] = await pool.execute<WinnerRow[]>(
      `SELECT h.urutan,
              w.id,
              w.peserta_tipe,
              COALESCE(a.nama, pt.nama) AS nama,
              a.nip,
              CASE
                WHEN w.peserta_tipe = 'tamu' THEN 'Tamu'
                ELSE a.jabatan
              END AS jabatan,
              CASE
                WHEN w.peserta_tipe = 'tamu' THEN NULL
                ELSE a.unit_kerja
              END AS unit_kerja,
              pt.instansi,
              w.waktu
       FROM doorprize_winners w
       JOIN doorprize_hadiah h ON h.id = w.hadiah_id
       LEFT JOIN anggota a ON a.id = w.anggota_id
       LEFT JOIN presensi_tamu pt ON pt.id = w.tamu_id
       WHERE w.kegiatan_id = ?
       ORDER BY h.urutan ASC, w.id ASC`,
      [kegiatan_id]
    );

    const kegiatan = kegiatanRows[0];
    const setup = setupRows[0] ?? null;
    const winners = winnerRows.map((winner, index) => ({
      ...winner,
      urutan: index + 1,
    }));

    let logoDataUrl = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "logo_dwp.png");
      const logoBuffer = await readFile(logoPath);
      logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch (error) {
      console.warn("Logo PDF doorprize tidak dapat dimuat:", error);
    }

    const html = buildHtml({ kegiatan, setup, winners, logoDataUrl });

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-crash-reporter",
        "--disable-crashpad",
        "--no-crash-upload",
        "--disable-features=Crashpad",
        "--user-data-dir=/tmp/chromium-user-data",
        "--data-path=/tmp/chromium-data",
        "--disk-cache-dir=/tmp/chromium-cache",
        "--homedir=/tmp",
      ],
    });

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      const pdfRaw = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "1.4cm", right: "1.2cm", bottom: "1.4cm", left: "1.2cm" },
      });
      pdfBuffer = Buffer.from(pdfRaw);
    } finally {
      await browser.close();
    }

    const safeCode = String(kegiatan.event_code || kegiatan.id)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .toLowerCase();

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pemenang-doorprize-${safeCode}.pdf"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("PDF doorprize error:", error);
    return NextResponse.json({ error: "Gagal membuat PDF daftar pemenang doorprize" }, { status: 500 });
  }
}

function buildHtml(args: {
  kegiatan: KegiatanRow;
  setup: SetupRow | null;
  winners: Array<WinnerRow & { urutan: number }>;
  logoDataUrl: string;
}) {
  const { kegiatan, setup, winners, logoDataUrl } = args;
  const generatedAt = formatTanggalJam(new Date().toISOString());

  const rowsHtml = winners.length > 0
    ? winners.map((winner) => `
      <tr>
        <td class="center">${winner.urutan}</td>
        <td>${escHtml(winner.nama)}</td>
        <td>${escHtml(winner.peserta_tipe === "tamu" ? "Tamu" : "Anggota")}</td>
        <td>${escHtml(winner.nip ?? "-")}</td>
        <td>${escHtml(winner.jabatan ?? "-")}</td>
        <td>${escHtml(winner.unit_kerja ?? winner.instansi ?? "-")}</td>
        <td class="center">${escHtml(formatTanggalJam(winner.waktu))}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="7" class="empty">Belum ada pemenang doorprize.</td>
      </tr>
    `;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Daftar Pemenang Doorprize</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      margin: 0;
      font-size: 12px;
      background: #ffffff;
    }
    .page { width: 100%; }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 2px solid #7b1fa2;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .logo {
      width: 56px;
      height: 56px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .logo-fallback {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #f3e8ff;
      color: #7b1fa2;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 18px;
      flex-shrink: 0;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      color: #6a1b9a;
    }
    .subtitle {
      margin-top: 4px;
      color: #6b7280;
      font-size: 12px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 170px 1fr;
      gap: 8px 14px;
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 18px;
    }
    .meta-label {
      color: #6b7280;
      font-weight: 600;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 18px;
    }
    .stat {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 12px;
      background: #fff;
    }
    .stat-label {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead th {
      background: #7b1fa2;
      color: white;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .05em;
      padding: 10px 8px;
      text-align: left;
    }
    tbody td {
      border-bottom: 1px solid #e5e7eb;
      padding: 10px 8px;
      vertical-align: top;
    }
    tbody tr:nth-child(even) { background: #fafafa; }
    .center { text-align: center; }
    .empty {
      text-align: center;
      color: #6b7280;
      padding: 18px 8px;
    }
    .footer {
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #6b7280;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${logoDataUrl
        ? `<img src="${logoDataUrl}" alt="Logo DWP" class="logo" />`
        : `<div class="logo-fallback">DWP</div>`}
      <div>
        <h1>Daftar Pemenang Doorprize</h1>
        <div class="subtitle">Dharma Wanita Persatuan</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-label">Kegiatan</div>
      <div>${escHtml(kegiatan.judul)}</div>
      <div class="meta-label">Tanggal Kegiatan</div>
      <div>${escHtml(formatTanggalPanjang(kegiatan.tanggal))}</div>
      <div class="meta-label">Lokasi</div>
      <div>${escHtml(kegiatan.lokasi ?? "-")}</div>
      <div class="meta-label">Kode Event</div>
      <div>${escHtml(kegiatan.event_code ?? "-")}</div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">Total Pemenang</div>
        <div class="stat-value">${winners.length} pemenang</div>
      </div>
      <div class="stat">
        <div class="stat-label">Jumlah Hadiah</div>
        <div class="stat-value">${setup ? `${setup.jumlah_hadiah} hadiah` : "-"}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="center" style="width:50px;">No</th>
          <th>Nama</th>
          <th style="width:90px;">Jenis</th>
          <th style="width:120px;">NIP</th>
          <th>Jabatan</th>
          <th>Instansi / Unit Kerja</th>
          <th class="center" style="width:150px;">Waktu</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="footer">
      <span>Dokumen dibuat otomatis oleh sistem DWP</span>
      <span>Diunduh pada ${escHtml(generatedAt)}</span>
    </div>
  </div>
</body>
</html>`;
}

function escHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}