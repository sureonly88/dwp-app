import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getArisanBelumMenerimaReport } from "@/lib/arisan-belum-menerima";

// GET /api/arisan/belum-menerima/export?tahun=&bulan=
export async function GET(req: NextRequest) {
  try {
    const report = await getArisanBelumMenerimaReport(new URL(req.url).searchParams);

    const worksheetData = [
      ["Laporan Anggota Belum Menerima Arisan"],
      ["Periode", report.summary.label],
      ["Total Belum Menerima", report.summary.total_belum_menerima],
      ["Total Sudah Menerima", report.summary.total_sudah_menerima],
      ["Total Anggota Eligible", report.summary.total_anggota_eligible],
      [],
      ["No", "Nama", "NIP", "Jabatan", "Unit Kerja", "Status Keanggotaan", "No HP", "Email"],
      ...report.rows.map((row, index) => [
        index + 1,
        row.nama,
        row.nip,
        row.jabatan,
        row.unit_kerja,
        row.status_keanggotaan,
        row.no_hp ?? "",
        row.email ?? "",
      ]),
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 22 },
      { wch: 26 },
      { wch: 28 },
      { wch: 22 },
      { wch: 18 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Belum Menerima");

    const workbookBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const filename = `anggota-belum-menerima-arisan-${report.summary.tahun}-${String(report.summary.bulan).padStart(2, "0")}.xlsx`;

    return new NextResponse(new Uint8Array(workbookBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Export arisan belum menerima error:", error);
    return NextResponse.json({ error: "Gagal mengekspor data anggota yang belum menerima arisan" }, { status: 500 });
  }
}

