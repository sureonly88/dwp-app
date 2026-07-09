import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2";
import puppeteer from "puppeteer";
import pool from "@/lib/db";
import {
  buildAnggotaWhereClause,
  buildEffectiveStatusSql,
  ensureAnggotaSchema,
  type StatusKeanggotaan,
} from "@/lib/anggota";

export const runtime = "nodejs";

const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

interface AnggotaPdfRow extends RowDataPacket {
  nama: string;
  nip: string;
  status: "Aktif" | "Non-Aktif" | "Cuti";
  status_keanggotaan: StatusKeanggotaan;
  tanggal_lahir: string | null;
  tanggal_pensiun: string | null;
}

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

function formatTanggalSingkat(dateStr: string | null) {
  if (!dateStr) return "-";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";

  return `${String(date.getDate()).padStart(2, "0")} ${BULAN_ID[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}

function formatFilterValue(value: string, fallback = "Semua") {
  const normalized = value.trim();
  return normalized ? normalized : fallback;
}

// GET /api/anggota/pdf?search=&status=&unit=&jenis=&statusKeanggotaan=
export async function GET(req: NextRequest) {
  try {
    await ensureAnggotaSchema();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "";
    const statusKeanggotaan = searchParams.get("statusKeanggotaan") ?? "";
    const unit = searchParams.get("unit") ?? "";
    const jenis = searchParams.get("jenis") ?? "";

    const { where, params } = buildAnggotaWhereClause({
      search,
      status,
      statusKeanggotaan,
      unit,
      jenis,
    });
    const effectiveStatusSql = buildEffectiveStatusSql();

    const [rows] = await pool.execute<AnggotaPdfRow[]>(
      `SELECT nama, nip,
              ${effectiveStatusSql} AS status,
              status_keanggotaan, tanggal_lahir, tanggal_pensiun
       FROM anggota ${where}
       ORDER BY created_at DESC`,
      params,
    );

    let logoDataUrl = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "logo_dwp.png");
      const logoBuffer = await readFile(logoPath);
      logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch (error) {
      console.warn("Logo PDF anggota tidak dapat dimuat:", error);
    }

    const html = buildHtml({
      rows,
      logoDataUrl,
      filters: {
        search,
        status,
        statusKeanggotaan,
        unit,
        jenis,
      },
    });

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
        margin: { top: "1.2cm", right: "1cm", bottom: "1.2cm", left: "1cm" },
      });
      pdfBuffer = Buffer.from(pdfRaw);
    } finally {
      await browser.close();
    }

    const filename = `data-anggota-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("PDF anggota error:", error);
    return NextResponse.json({ error: "Gagal membuat PDF data anggota" }, { status: 500 });
  }
}

function buildHtml(args: {
  rows: AnggotaPdfRow[];
  logoDataUrl: string;
  filters: {
    search: string;
    status: string;
    statusKeanggotaan: string;
    unit: string;
    jenis: string;
  };
}) {
  const { rows, logoDataUrl, filters } = args;
  const generatedAt = formatTanggalJam(new Date().toISOString());

  const stats = rows.reduce(
    (acc, row) => {
      if (row.status === "Aktif") acc.aktif += 1;
      if (row.status === "Non-Aktif") acc.nonAktif += 1;
      if (row.status === "Cuti") acc.cuti += 1;
      return acc;
    },
    { aktif: 0, nonAktif: 0, cuti: 0 },
  );

  const rowsHtml = rows.length > 0
    ? rows.map((row, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escHtml(row.nama)}</td>
        <td>${escHtml(row.nip)}</td>
        <td>${escHtml(row.status_keanggotaan)}</td>
        <td class="center">${escHtml(formatTanggalSingkat(row.tanggal_lahir))}</td>
        <td class="center">${escHtml(formatTanggalSingkat(row.tanggal_pensiun))}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="6" class="empty">Tidak ada data anggota yang sesuai filter.</td>
      </tr>
    `;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Data Anggota DWP</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      margin: 0;
      font-size: 11px;
      background: #ffffff;
    }
    .page { width: 100%; }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 2px solid #7b1fa2;
      padding-bottom: 14px;
      margin-bottom: 16px;
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
      grid-template-columns: 170px 1fr 170px 1fr;
      gap: 8px 14px;
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .meta-label {
      color: #6b7280;
      font-weight: 600;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 12px;
      background: #fff;
    }
    .stat-label {
      font-size: 10px;
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
    thead {
      display: table-header-group;
    }
    thead th {
      background: #7b1fa2;
      color: white;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .05em;
      padding: 9px 7px;
      text-align: left;
      white-space: nowrap;
    }
    tbody td {
      border-bottom: 1px solid #e5e7eb;
      padding: 8px 7px;
      vertical-align: top;
    }
    tbody tr {
      page-break-inside: avoid;
    }
    tbody tr:nth-child(even) {
      background: #fafafa;
    }
    .center { text-align: center; }
    .empty {
      text-align: center;
      color: #6b7280;
      padding: 18px 8px;
    }
    .footer {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #6b7280;
      font-size: 10px;
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
        <h1>Laporan Data Anggota</h1>
        <div class="subtitle">Dharma Wanita Persatuan</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-label">Kata Kunci</div>
      <div>${escHtml(formatFilterValue(filters.search, "Semua data"))}</div>
      <div class="meta-label">Status</div>
      <div>${escHtml(formatFilterValue(filters.status))}</div>
      <div class="meta-label">Unit Kerja</div>
      <div>${escHtml(formatFilterValue(filters.unit))}</div>
      <div class="meta-label">Jenis</div>
      <div>${escHtml(formatFilterValue(filters.jenis))}</div>
      <div class="meta-label">Status Keanggotaan</div>
      <div>${escHtml(formatFilterValue(filters.statusKeanggotaan))}</div>
      <div class="meta-label">Tanggal Cetak</div>
      <div>${escHtml(formatTanggalPanjang(new Date().toISOString()))}</div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">Total Anggota</div>
        <div class="stat-value">${rows.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Aktif</div>
        <div class="stat-value">${stats.aktif}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Non-Aktif</div>
        <div class="stat-value">${stats.nonAktif}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Cuti</div>
        <div class="stat-value">${stats.cuti}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="center" style="width:45px;">No</th>
          <th>Nama</th>
          <th style="width:130px;">NIP</th>
          <th style="width:130px;">Status Keanggotaan</th>
          <th class="center" style="width:95px;">Tgl Lahir</th>
          <th class="center" style="width:95px;">Tgl Pensiun</th>
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}