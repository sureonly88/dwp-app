import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import { requireSession } from "@/lib/kas";
import { getRekapIuranKas, type RekapIuranKasResult } from "@/lib/kas-rekap-iuran";

export const runtime = "nodejs";

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

type PrintScope = "all" | "iuran_anggota" | "iuran_konsumsi_anggota" | "iuran_pengurus";

const PRINT_SCOPE_LABELS: Record<PrintScope, string> = {
  all: "Semua Kas Iuran",
  iuran_anggota: "Iuran Kas Anggota",
  iuran_konsumsi_anggota: "Iuran Kas Konsumsi",
  iuran_pengurus: "Iuran Kas Pengurus",
};

function escHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatRp(value: number) {
  return `Rp ${(value ?? 0).toLocaleString("id-ID")}`;
}

function formatTanggal(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return dateStr;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return `${String(day).padStart(2, "0")} ${BULAN_ID[month - 1]} ${year}`;
}

function formatTanggalJam(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = BULAN_ID[date.getMonth()];
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hour}:${minute}`;
}

function parsePrintScope(value: string | null): PrintScope {
  if (
    value === "iuran_anggota" ||
    value === "iuran_konsumsi_anggota" ||
    value === "iuran_pengurus"
  ) {
    return value;
  }

  return "all";
}

function totalFromFunds(funds: RekapIuranKasResult["summary"]) {
  return {
    saldo_awal: funds.reduce((sum, fund) => sum + fund.saldo_awal, 0),
    total_pemasukan: funds.reduce((sum, fund) => sum + fund.total_pemasukan, 0),
    total_pengeluaran: funds.reduce((sum, fund) => sum + fund.total_pengeluaran, 0),
    saldo_akhir: funds.reduce((sum, fund) => sum + fund.saldo_akhir, 0),
  };
}

function filterByPrintScope(laporan: RekapIuranKasResult, scope: PrintScope): RekapIuranKasResult {
  if (scope === "all") return laporan;

  const summary = laporan.summary.filter((fund) => fund.code === scope);
  const monthly = laporan.monthly.map((month) => {
    const funds = month.funds.filter((fund) => fund.code === scope);

    return {
      ...month,
      funds,
      total_pemasukan: funds.reduce((sum, fund) => sum + fund.total_pemasukan, 0),
      total_pengeluaran: funds.reduce((sum, fund) => sum + fund.total_pengeluaran, 0),
      saldo_akhir: funds.reduce((sum, fund) => sum + fund.saldo_akhir, 0),
    };
  });

  return {
    ...laporan,
    summary,
    total: totalFromFunds(summary),
    monthly,
    transaksi: laporan.transaksi.filter((trx) => trx.dana_code === scope),
  };
}

export async function GET(req: NextRequest) {
  const { response } = await requireSession(req);
  if (response) return response;

  try {
    const searchParams = new URL(req.url).searchParams;
    const printScope = parsePrintScope(searchParams.get("jenis"));
    const laporan = filterByPrintScope(await getRekapIuranKas(searchParams), printScope);

    let logoDataUrl = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "logo_dwp.png");
      const logoBuffer = await readFile(logoPath);
      logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch (error) {
      console.warn("Logo PDF rekap iuran tidak dapat dimuat:", error);
    }

    const html = buildHtml(laporan, logoDataUrl, PRINT_SCOPE_LABELS[printScope]);
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

    const filename = `rekap-kas-iuran-${printScope}-${laporan.periode.awal}-${laporan.periode.akhir}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("PDF rekap iuran error:", error);
    const message = error instanceof Error ? error.message : "Gagal membuat PDF rekap iuran";
    const status = message.includes("Periode awal") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function buildHtml(laporan: RekapIuranKasResult, logoDataUrl: string, printScopeLabel: string) {
  const summaryRows = laporan.summary.map((fund) => `
    <tr>
      <td>${escHtml(fund.name)}</td>
      <td class="num">${formatRp(fund.saldo_awal)}</td>
      <td class="num plus">${formatRp(fund.total_pemasukan)}</td>
      <td class="num minus">${formatRp(fund.total_pengeluaran)}</td>
      <td class="num strong">${formatRp(fund.saldo_akhir)}</td>
    </tr>
  `).join("");

  const monthlyRows = laporan.monthly.flatMap((month) => (
    month.funds.map((fund, index) => `
      <tr>
        ${index === 0 ? `<td rowspan="${month.funds.length}" class="month">${escHtml(month.label)}</td>` : ""}
        <td>${escHtml(fund.name)}</td>
        <td class="num">${formatRp(fund.saldo_awal)}</td>
        <td class="num plus">${fund.total_pemasukan > 0 ? formatRp(fund.total_pemasukan) : "-"}</td>
        <td class="num minus">${fund.total_pengeluaran > 0 ? formatRp(fund.total_pengeluaran) : "-"}</td>
        <td class="num strong">${formatRp(fund.saldo_akhir)}</td>
      </tr>
    `)
  )).join("");

  const transactionRows = laporan.transaksi.length > 0
    ? laporan.transaksi.map((trx, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${formatTanggal(trx.transaction_date)}</td>
        <td class="mono">${escHtml(trx.transaction_number)}</td>
        <td>${escHtml(trx.dana_name)}</td>
        <td class="center">${trx.type === "income" ? "Masuk" : "Keluar"}</td>
        <td>${escHtml(trx.category_name)}</td>
        <td>${escHtml(trx.description ?? "-")}</td>
        <td class="num ${trx.type === "income" ? "plus" : "minus"}">${formatRp(trx.amount)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8" class="empty">Tidak ada transaksi iuran disetujui pada periode ini.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Rekap Kas Iuran</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      font-size: 11px;
      line-height: 1.35;
      background: #ffffff;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 12px;
      border-bottom: 3px solid #b91c5c;
      margin-bottom: 14px;
    }
    .logo {
      width: 58px;
      height: 58px;
      object-fit: contain;
      flex: 0 0 auto;
    }
    .title-wrap { flex: 1; text-align: center; }
    .org { font-size: 15px; font-weight: 700; text-transform: uppercase; color: #831843; }
    h1 { margin: 2px 0 0; font-size: 18px; text-transform: uppercase; color: #111827; }
    .meta { margin-top: 4px; font-size: 10px; color: #4b5563; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
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
    .stat-value { margin-top: 3px; font-size: 13px; font-weight: 700; color: #831843; }
    h2 {
      margin: 15px 0 7px;
      font-size: 12px;
      text-transform: uppercase;
      color: #831843;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td {
      border: 1px solid #d1d5db;
      padding: 5px 6px;
      vertical-align: top;
    }
    th {
      background: #fce7f3;
      color: #831843;
      font-weight: 700;
      text-align: left;
    }
    tfoot td {
      background: #f9fafb;
      font-weight: 700;
    }
    .num { text-align: right; white-space: nowrap; }
    .center { text-align: center; }
    .month { font-weight: 700; color: #111827; white-space: nowrap; }
    .strong { font-weight: 700; }
    .plus { color: #047857; }
    .minus { color: #b91c1c; }
    .mono { font-family: "Courier New", monospace; font-size: 10px; }
    .empty { text-align: center; color: #6b7280; padding: 12px; }
    .section-break { page-break-before: auto; }
    .footer {
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      color: #6b7280;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Logo DWP" />` : `<div class="logo"></div>`}
    <div class="title-wrap">
      <div class="org">Dharma Wanita Persatuan</div>
      <h1>Laporan Rekap Kas Iuran</h1>
      <div class="meta">Periode ${escHtml(laporan.periode.label)} | ${escHtml(printScopeLabel)} | Tanggal serah terima ${formatTanggal(laporan.periode.tanggal_serah_terima)}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-label">Saldo Awal</div><div class="stat-value">${formatRp(laporan.total.saldo_awal)}</div></div>
    <div class="stat"><div class="stat-label">Total Masuk</div><div class="stat-value plus">${formatRp(laporan.total.total_pemasukan)}</div></div>
    <div class="stat"><div class="stat-label">Total Keluar</div><div class="stat-value minus">${formatRp(laporan.total.total_pengeluaran)}</div></div>
    <div class="stat"><div class="stat-label">Saldo Akhir</div><div class="stat-value">${formatRp(laporan.total.saldo_akhir)}</div></div>
  </div>

  <h2>Ringkasan Dana Iuran</h2>
  <table>
    <thead>
      <tr>
        <th>Dana</th>
        <th class="num">Saldo Awal</th>
        <th class="num">Pemasukan</th>
        <th class="num">Pengeluaran</th>
        <th class="num">Saldo Akhir</th>
      </tr>
    </thead>
    <tbody>${summaryRows}</tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td class="num">${formatRp(laporan.total.saldo_awal)}</td>
        <td class="num plus">${formatRp(laporan.total.total_pemasukan)}</td>
        <td class="num minus">${formatRp(laporan.total.total_pengeluaran)}</td>
        <td class="num">${formatRp(laporan.total.saldo_akhir)}</td>
      </tr>
    </tfoot>
  </table>

  <h2>Rekap Bulanan</h2>
  <table>
    <thead>
      <tr>
        <th>Bulan</th>
        <th>Dana</th>
        <th class="num">Saldo Awal</th>
        <th class="num">Masuk</th>
        <th class="num">Keluar</th>
        <th class="num">Saldo Akhir</th>
      </tr>
    </thead>
    <tbody>${monthlyRows}</tbody>
  </table>

  <h2 class="section-break">Detail Transaksi Iuran Disetujui</h2>
  <table>
    <thead>
      <tr>
        <th class="center">No</th>
        <th>Tanggal</th>
        <th>Nomor</th>
        <th>Dana</th>
        <th class="center">Tipe</th>
        <th>Kategori</th>
        <th>Keterangan</th>
        <th class="num">Nominal</th>
      </tr>
    </thead>
    <tbody>${transactionRows}</tbody>
  </table>

  <div class="footer">
    <span>Dicetak: ${formatTanggalJam(new Date())}</span>
    <span>Transaksi dihitung hanya yang berstatus disetujui.</span>
  </div>
</body>
</html>`;
}
