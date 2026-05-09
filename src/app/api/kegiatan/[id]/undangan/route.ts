import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import puppeteer from "puppeteer";

const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmtJam(t: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

// POST /api/kegiatan/[id]/undangan
// Body: { nomor, penandatangan, jabatan_ttd, nip_ttd, kota, catatan }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { nomor = "", penandatangan, jabatan_ttd = "Ketua", nip_ttd = "", kota = "Jakarta", catatan = "" } = body as {
      nomor?: string;
      penandatangan: string;
      jabatan_ttd?: string;
      nip_ttd?: string;
      kota?: string;
      catatan?: string;
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
    const tglKegStr = `${hariStr}, ${tgl.getDate()} ${BULAN_ID[tgl.getMonth()]} ${tgl.getFullYear()}`;
    const waktuMulai = fmtJam(kegiatan.waktu_mulai as string | null);
    const waktuSelesai = fmtJam(kegiatan.waktu_selesai as string | null);
    const waktuStr = waktuMulai
      ? `${waktuMulai} WIB${waktuSelesai ? ` s.d. ${waktuSelesai} WIB` : " s.d. selesai"}`
      : "-";
    const now = new Date();
    const tglSurat = `${now.getDate()} ${BULAN_ID[now.getMonth()]} ${now.getFullYear()}`;

    const html = buildHtml({
      nomor,
      penandatangan,
      jabatan_ttd,
      nip_ttd,
      kota,
      catatan,
      judul: kegiatan.judul as string,
      deskripsi: kegiatan.deskripsi as string | null,
      kategori: kegiatan.kategori as string,
      lokasi: kegiatan.lokasi as string | null,
      tglKegStr,
      waktuStr,
      tglSurat,
    });

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",   // wajib di Docker (shared memory terbatas)
        "--disable-gpu",
        "--single-process",
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
  nip_ttd: string;
  kota: string;
  catatan: string;
  judul: string;
  deskripsi: string | null;
  kategori: string;
  lokasi: string | null;
  tglKegStr: string;
  waktuStr: string;
  tglSurat: string;
}) {
  const isi = d.deskripsi
    ? `pelaksanaan ${d.deskripsi}`
    : `pelaksanaan kegiatan ${d.kategori} Dharma Wanita Persatuan`;

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
  line-height: 1.45;
}
.kop {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 8px;
}
.kop-logo {
  width: 90px;
  height: 90px;
  border: 3px solid #7b0000;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 7pt;
  text-align: center;
  font-weight: bold;
  color: #7b0000;
  padding: 8px;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}
.kop-logo .big { font-size: 9pt; letter-spacing: 2px; }
.kop-text h1 { font-size: 18pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
.kop-text h2 { font-size: 13pt; font-weight: normal; color: #222; }
.kop-text .alamat { font-size: 10pt; color: #555; margin-top: 3px; }
hr.thick { border: none; border-top: 3.5px solid #7b0000; margin: 6px 0 2px; }
hr.thin  { border: none; border-top: 1px solid #000;    margin: 0 0 12px; }
.meta { margin: 12px 0; }
.meta table { border-collapse: collapse; }
.meta td { padding: 2px 0; vertical-align: top; }
.meta td.lbl { width: 95px; }
.meta td.sep { width: 16px; padding: 2px 4px; }
.kepada { margin: 12px 0 4px; }
.salam { font-style: italic; margin: 10px 0; }
.body p { margin: 6px 0; text-align: justify; }
.detail { margin: 10px 0 10px 24px; border-collapse: collapse; }
.detail td { padding: 2px 0; vertical-align: top; }
.detail td.lbl { width: 140px; }
.detail td.sep { width: 16px; padding: 2px 4px; }
.penutup p { margin: 6px 0; text-align: justify; }
.ttd-wrap { margin-top: 24px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
.ttd { text-align: center; min-width: 240px; }
.ttd .loc { margin-bottom: 6px; }
.ttd .jabatan { font-weight: bold; }
.ttd-space { height: 60px; }
.ttd .nama { font-weight: bold; text-decoration: underline; }
.ttd .nip-line { font-size: 11pt; }
</style>
</head>
<body>
<div class="kop">
  <div class="kop-logo">
    <span class="big">DWP</span>
    <span>DHARMA</span>
    <span>WANITA</span>
    <span>PERSATUAN</span>
  </div>
  <div class="kop-text">
    <h1>Dharma Wanita Persatuan</h1>
    <h2>Pengurus Besar</h2>
    <p class="alamat">Jakarta &mdash; Indonesia</p>
  </div>
</div>
<hr class="thick"/>
<hr class="thin"/>

<div class="meta">
  <table>
    <tr>
      <td class="lbl">Nomor</td>
      <td class="sep">:</td>
      <td>${d.nomor || "&ndash;"}</td>
    </tr>
    <tr>
      <td class="lbl">Lampiran</td>
      <td class="sep">:</td>
      <td>&ndash;</td>
    </tr>
    <tr>
      <td class="lbl">Perihal</td>
      <td class="sep">:</td>
      <td><strong>Undangan ${escHtml(d.judul)}</strong></td>
    </tr>
  </table>
</div>

<div class="kepada">
  <p>Kepada Yth.</p>
  <p><strong>Seluruh Anggota Dharma Wanita Persatuan</strong></p>
  <p>di Tempat</p>
</div>

<div class="salam">
  <p>Assalamu&rsquo;alaikum Warahmatullahi Wabarakatuh</p>
</div>

<div class="body">
  <p>Dengan hormat,</p>
  <p>
    Dalam rangka ${escHtml(isi)}, dengan ini kami mengundang Ibu untuk dapat hadir
    dalam kegiatan berikut:
  </p>
</div>

<table class="detail">
  <tr>
    <td class="lbl">Hari / Tanggal</td>
    <td class="sep">:</td>
    <td>${escHtml(d.tglKegStr)}</td>
  </tr>
  <tr>
    <td class="lbl">Waktu</td>
    <td class="sep">:</td>
    <td>${escHtml(d.waktuStr)}</td>
  </tr>
  <tr>
    <td class="lbl">Tempat</td>
    <td class="sep">:</td>
    <td>${d.lokasi ? escHtml(d.lokasi) : "&ndash;"}</td>
  </tr>
  <tr>
    <td class="lbl">Acara</td>
    <td class="sep">:</td>
    <td><strong>${escHtml(d.judul)}</strong></td>
  </tr>
</table>

${d.catatan ? `<div class="body"><p>${escHtml(d.catatan)}</p></div>` : ""}

<div class="penutup">
  <p>
    Mengingat pentingnya kegiatan tersebut, kami mohon kehadiran Ibu pada waktu
    dan tempat yang telah ditentukan di atas.
  </p>
  <p>
    Demikian undangan ini kami sampaikan. Atas perhatian dan kehadiran Ibu,
    kami ucapkan terima kasih.
  </p>
</div>

<div class="salam" style="margin-top:16px;">
  <p>Wassalamu&rsquo;alaikum Warahmatullahi Wabarakatuh</p>
</div>

<div class="ttd-wrap">
  <div class="ttd">
    <p class="loc">${escHtml(d.kota)}, ${escHtml(d.tglSurat)}</p>
    <p class="jabatan">${escHtml(d.jabatan_ttd)}</p>
    <p>Dharma Wanita Persatuan</p>
    <div class="ttd-space"></div>
    <p class="nama">${escHtml(d.penandatangan)}</p>
    ${d.nip_ttd ? `<p class="nip-line">NIP. ${escHtml(d.nip_ttd)}</p>` : ""}
  </div>
</div>
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
