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

function fmtJam(t: string | null) {
  if (!t) return "";
  // Format HH.MM (Indonesian style with period separator)
  return t.slice(0, 5).replace(":", ".");
}

// POST /api/kegiatan/[id]/undangan
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdmin(req);
  if (response) return response;
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      nomor = "",
      penandatangan,
      jabatan_ttd = "Ketua",
      kota = "Banjarmasin",
      sub_org = "",
      alamat_org = "",
      dress_code = "",
      zona_waktu = "Wita",
      kepada = "Pengurus & Anggota DWP",
    } = body as {
      nomor?: string;
      penandatangan: string;
      jabatan_ttd?: string;
      kota?: string;
      sub_org?: string;
      alamat_org?: string;
      dress_code?: string;
      zona_waktu?: string;
      kepada?: string;
    };

    if (!penandatangan?.trim()) {
      return NextResponse.json({ error: "Nama penandatangan wajib diisi" }, { status: 400 });
    }

    // Fetch kegiatan
    const [[kegiatan]] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM kegiatan WHERE id = ?",
      [id]
    );
    if (!kegiatan) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }

    const tgl = new Date(kegiatan.tanggal as string);
    const hariStr = HARI_ID[tgl.getDay()];
    const tglKegStr = `${hariStr} / ${tgl.getDate()} ${BULAN_ID[tgl.getMonth()]} ${tgl.getFullYear()}`;
    const waktuMulai = fmtJam(kegiatan.waktu_mulai as string | null);
    let logoDataUrl = "";

    try {
      const logoPath = path.join(process.cwd(), "public", "logo_dwp.png");
      const logoBuffer = await readFile(logoPath);
      logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch (error) {
      console.warn("Logo undangan tidak dapat dimuat:", error);
    }

    const html = buildHtml({
      nomor,
      penandatangan,
      jabatan_ttd,
      kota,
      sub_org,
      alamat_org,
      dress_code,
      zona_waktu,
      kepada,
      judul: kegiatan.judul as string,
      deskripsi: kegiatan.deskripsi as string | null,
      kategori: kegiatan.kategori as string,
      lokasi: kegiatan.lokasi as string | null,
      tglKegStr,
      waktuMulai,
      unit_kerja_bertugas: (kegiatan.unit_kerja_bertugas as string | null) ?? "",
      logoDataUrl,
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
        margin: { top: "2cm", bottom: "2cm", left: "2.5cm", right: "2cm" },
      });
      pdfBuffer = Buffer.from(pdfRaw);
    } finally {
      await browser.close();
    }

    const safeJudul = (kegiatan.judul as string).replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase();
    const filename = `undangan-${safeJudul}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Undangan PDF error:", err);
    return NextResponse.json({ error: "Gagal membuat PDF" }, { status: 500 });
  }
}

function buildHtml(d: {
  nomor: string;
  penandatangan: string;
  jabatan_ttd: string;
  kota: string;
  sub_org: string;
  alamat_org: string;
  dress_code: string;
  zona_waktu: string;
  kepada: string;
  judul: string;
  deskripsi: string | null;
  kategori: string;
  lokasi: string | null;
  tglKegStr: string;
  waktuMulai: string;
  unit_kerja_bertugas: string;
  logoDataUrl: string;
}) {
  // Build acara rows strictly from deskripsi kegiatan.
  const acaraItems = (d.deskripsi ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const acaraHtml = acaraItems.length > 0
    ? acaraItems
        .map((item, i) =>
          i === 0
            ? `- &nbsp;${escHtml(item)}`
            : `<br/><span style="display:inline-block;width:0"></span>- &nbsp;${escHtml(item)}`
        )
        .join("")
    : "&ndash;";

  const waktuStr = d.waktuMulai
    ? `Pukul ${d.waktuMulai} ${escHtml(d.zona_waktu)}`
    : "-";

  const nomorRow = d.nomor
    ? `<p style="text-align:right;font-size:10pt;margin-bottom:4px;">No. : ${escHtml(d.nomor)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: 'Times New Roman', Times, serif;
  font-size: 12pt;
  color: #000;
  line-height: 1.5;
}

/* ---- KOP ---- */
.kop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding-bottom: 8px;
}
.kop-logo {
  width: 82px;
  height: 82px;
  object-fit: contain;
  flex-shrink: 0;
}
.kop-logo-fallback {
  border: 3px double #5a4000;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 7pt;
  text-align: center;
  font-weight: bold;
  color: #5a4000;
  padding: 6px;
  letter-spacing: 0.5px;
}
.kop-logo-fallback .big { font-size: 11pt; letter-spacing: 3px; }
.kop-text { text-align: center; }
.kop-text h1 { font-size: 17pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; }
.kop-text h2 { font-size: 12.5pt; font-weight: bold; text-transform: uppercase; margin-top: 2px; }
.kop-text .alamat { font-size: 9.5pt; margin-top: 3px; }
hr.thick { border: none; border-top: 3px solid #000; margin: 6px 0 1px; }
hr.thin  { border: none; border-top: 1px solid #000; margin: 0 0 14px; }

/* ---- HEADER ROW ---- */
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}
.undangan-title {
  font-family: 'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive, sans-serif;
  font-size: 34pt;
  font-weight: bold;
  color: #1a3fa0;
  line-height: 1;
  padding-top: 4px;
}
.kepada-block { text-align: left; line-height: 1.7; font-size: 11.5pt; }
.kepada-block .lbl { margin-bottom: 2px; }

/* ---- BODY ---- */
.salam { font-style: italic; margin: 4px 0 10px; }
.body-text { margin: 0 0 8px; text-align: justify; }
.detail { margin: 2px 0 10px 10px; border-collapse: collapse; }
.detail td { padding: 2px 0; vertical-align: top; }
.detail td.lbl { width: 115px; }
.detail td.sep { width: 14px; padding: 2px 4px; }
.penutup { margin-top: 10px; text-align: justify; }
.salam-ttd { font-style: italic; margin: 10px 0 16px; }

/* ---- TTD ---- */
.ttd-wrap { display: flex; justify-content: flex-end; }
.ttd { text-align: center; min-width: 230px; }
.ttd-space { height: 65px; }
.ttd .nama { font-weight: bold; }

/* ---- BERTUGAS BOX ---- */
.bertugas-box {
  display: inline-block;
  margin-top: 22px;
  background: #3a8a30;
  color: #fff;
  padding: 9px 26px;
  font-weight: bold;
  font-size: 13pt;
  letter-spacing: 0.5px;
}
</style>
</head>
<body>

<!-- KOP -->
<div class="kop">
  ${d.logoDataUrl
    ? `<img class="kop-logo" src="${d.logoDataUrl}" alt="Logo Dharma Wanita Persatuan" />`
    : `<div class="kop-logo kop-logo-fallback">
    <span class="big">DWP</span>
    <span>DHARMA</span>
    <span>WANITA</span>
    <span>PERSATUAN</span>
  </div>`}
  <div class="kop-text">
    <h1>Dharma Wanita Persatuan</h1>
    ${d.sub_org ? `<h2>${escHtml(d.sub_org)}</h2>` : ""}
    ${d.alamat_org ? `<p class="alamat">Alamat : ${escHtml(d.alamat_org)}</p>` : ""}
  </div>
</div>
<hr class="thick"/>
<hr class="thin"/>

${nomorRow}

<!-- HEADER: Undangan (kiri) | Kepada (kanan) -->
<div class="header-row">
  <div class="undangan-title">Undangan</div>
  <div class="kepada-block">
    <p class="lbl">Kepada :</p>
    <p>Yth. Ibu /saudari</p>
    <p><strong>${escHtml(d.kepada)}</strong></p>
    <p>di &ndash; Tempat.</p>
  </div>
</div>

<!-- SALAM PEMBUKA -->
<div class="salam"><p>Assalamu&rsquo;alaikum Wr Wb</p></div>

<!-- ISI -->
<p class="body-text">
  Dengan &nbsp;ini kami mengundang Ibu /saudari untuk &nbsp;berhadir pada ${escHtml(d.judul)} Dharma
  Wanita Persatuan${d.sub_org ? ` (DWP) ${escHtml(d.sub_org)}` : ""} yang akan dilaksanakan pada :
</p>

<!-- DETAIL -->
<table class="detail">
  <tr>
    <td class="lbl">Hari / tgl</td>
    <td class="sep">:</td>
    <td>${escHtml(d.tglKegStr)}</td>
  </tr>
  <tr>
    <td class="lbl">Waktu</td>
    <td class="sep">:</td>
    <td>${waktuStr}</td>
  </tr>
  <tr>
    <td class="lbl">Tempat</td>
    <td class="sep">:</td>
    <td>${d.lokasi ? escHtml(d.lokasi) : "&ndash;"}</td>
  </tr>
  <tr>
    <td class="lbl">A &nbsp;c &nbsp;a &nbsp;r &nbsp;a</td>
    <td class="sep">:</td>
    <td>${acaraHtml}</td>
  </tr>
  ${d.dress_code ? `
  <tr>
    <td class="lbl">Dress Code</td>
    <td class="sep">:</td>
    <td>${escHtml(d.dress_code)}</td>
  </tr>` : ""}
</table>

<!-- PENUTUP -->
<p class="penutup">Demikian Undangan ini disampaikan, atas perhatiannya diucapkan terima kasih.</p>
<div class="salam-ttd"><p>Wassalamu&rsquo;alaikum Wr Wb</p></div>

<!-- TTD -->
<div class="ttd-wrap">
  <div class="ttd">
    <p>${escHtml(d.jabatan_ttd)} DWP ${escHtml(d.kota)},</p>
    <div class="ttd-space"></div>
    <p class="nama">${escHtml(d.penandatangan)}</p>
  </div>
</div>

<!-- YANG BERTUGAS (hanya jika ada) -->
${d.unit_kerja_bertugas ? `<div class="bertugas-box">Yang Bertugas Departemen &nbsp; ${escHtml(d.unit_kerja_bertugas)}</div>` : ""}

</body>
</html>`;
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
