import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import {
  type ArisanBelumMenerimaReport,
  getArisanBelumMenerimaReport,
} from "@/lib/arisan-belum-menerima";

export const runtime = "nodejs";

function escHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTanggalJam(date: Date) {
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const day = String(date.getDate()).padStart(2, "0");
  const month = bulan[date.getMonth()];
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hour}:${minute}`;
}

// GET /api/arisan/belum-menerima/pdf?tahun=&bulan=
export async function GET(req: NextRequest) {
  try {
    const report = await getArisanBelumMenerimaReport(new URL(req.url).searchParams);

    let logoDataUrl = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "logo_dwp.png");
      const logoBuffer = await readFile(logoPath);
      logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch (error) {
      console.warn("Logo PDF arisan belum menerima tidak dapat dimuat:", error);
    }

    const html = buildHtml(report, logoDataUrl);
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
        landscape: true,
        printBackground: true,
        margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
      });
      pdfBuffer = Buffer.from(pdfRaw);
    } finally {
      await browser.close();
    }

    const filename = `anggota-belum-menerima-arisan-${report.summary.tahun}-${String(report.summary.bulan).padStart(2, "0")}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("PDF arisan belum menerima error:", error);
    return NextResponse.json({ error: "Gagal membuat PDF anggota yang belum menerima arisan" }, { status: 500 });
  }
}

function buildHtml(report: ArisanBelumMenerimaReport, logoDataUrl: string) {
  const generatedAt = formatTanggalJam(new Date());
  const rowsHtml = report.rows.length > 0
    ? report.rows.map((row, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escHtml(row.nama)}</td>
        <td>${escHtml(row.nip || "-")}</td>
        <td>${escHtml(row.jabatan || "-")}</td>
        <td>${escHtml(row.unit_kerja || "-")}</td>
        <td>${escHtml(row.status_keanggotaan || "-")}</td>
        <td>${escHtml(row.no_hp || "-")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="7" class="empty">Semua anggota eligible sudah menerima arisan pada periode ini.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Anggota Belum Menerima Arisan</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      font-size: 11px;
      background: #ffffff;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 12px;
      border-bottom: 3px solid #7b1fa2;
      margin-bottom: 14px;
    }
    .logo {
      width: 58px;
      height: 58px;
      object-fit: contain;
      flex: 0 0 auto;
    }
    .logo-fallback {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #f3e8ff;
      color: #7b1fa2;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 18px;
      flex: 0 0 auto;
    }
    .title-wrap { flex: 1; text-align: center; }
    .org { font-size: 15px; font-weight: 700; text-transform: uppercase; color: #6a1b9a; }
    h1 { margin: 2px 0 0; font-size: 18px; text-transform: uppercase; color: #111827; }
    .meta { margin-top: 4px; font-size: 10px; color: #4b5563; }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin: 12px 0 14px;
    }
    .stat {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px;
      background: #fafafa;
    }
    .stat-label { color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; }
    .stat-value { margin-top: 3px; font-size: 15px; font-weight: 700; color: #6a1b9a; }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th {
      background: #f3e8ff;
      color: #581c87;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: .04em;
      border: 1px solid #ddd6fe;
      padding: 7px 6px;
      text-align: left;
    }
    td {
      border: 1px solid #e5e7eb;
      padding: 7px 6px;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td { background: #fafafa; }
    .center { text-align: center; }
    .empty { text-align: center; color: #6b7280; padding: 18px; }
    .footer {
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      color: #6b7280;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="DWP" />` : `<div class="logo-fallback">DWP</div>`}
    <div class="title-wrap">
      <div class="org">Dharma Wanita Persatuan</div>
      <h1>Anggota Belum Menerima Arisan</h1>
      <div class="meta">Periode ${escHtml(report.summary.label)}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Belum Menerima</div>
      <div class="stat-value">${report.summary.total_belum_menerima} orang</div>
    </div>
    <div class="stat">
      <div class="stat-label">Sudah Menerima</div>
      <div class="stat-value">${report.summary.total_sudah_menerima} orang</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total Anggota Eligible</div>
      <div class="stat-value">${report.summary.total_anggota_eligible} orang</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:38px;">No</th>
        <th>Nama</th>
        <th>NIP</th>
        <th>Jabatan</th>
        <th>Unit Kerja</th>
        <th>Status Keanggotaan</th>
        <th>No HP</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="footer">
    <span>Diunduh pada ${escHtml(generatedAt)}</span>
    <span>DWP App</span>
  </div>
</body>
</html>`;
}

