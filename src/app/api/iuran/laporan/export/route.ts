import { NextRequest } from "next/server";
import { getLaporanIuran } from "@/lib/iuran";

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// GET /api/iuran/laporan/export?bulan=&tahun=&unit=&pengurus=&status=
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const now = new Date();
  const bulan = Number(sp.get("bulan") ?? now.getMonth() + 1);
  const tahun = Number(sp.get("tahun") ?? now.getFullYear());
  const unit = sp.get("unit") ?? "";
  const pengurusParam = sp.get("pengurus") ?? "all";
  const status = sp.get("status") ?? "";
  const pengurus: "all" | "pengurus" | "anggota" =
    pengurusParam === "pengurus" || pengurusParam === "anggota" ? pengurusParam : "all";

  const laporan = await getLaporanIuran({
    bulan,
    tahun,
    unit: unit || undefined,
    pengurus,
    status: status || undefined,
  });

  const header = [
    "No", "Nama", "NIP", "Unit Kerja", "Jabatan", "Pengurus",
    "Status", "Iuran Arisan Anggota", "Iuran Konsumsi Anggota", "Iuran Pengurus", "Total", "Keterangan",
  ];

  const lines = [header.join(",")];
  laporan.rows.forEach((r, i) => {
    lines.push([
      i + 1,
      csvCell(r.nama),
      csvCell(r.nip),
      csvCell(r.unit_kerja),
      csvCell(r.jabatan),
      r.is_pengurus ? "Ya" : "Tidak",
      csvCell(r.status),
      r.iuran_anggota,
      r.iuran_konsumsi_anggota,
      r.iuran_pengurus,
      r.total,
      csvCell(r.keterangan),
    ].join(","));
  });

  // Summary
  lines.push("");
  lines.push(`Periode,${csvCell(laporan.periode.label)}`);
  lines.push(`Saldo Awal Arisan Anggota,${laporan.saldo_iuran_arisan.saldo_awal}`);
  lines.push(`Iuran Arisan Anggota Bulan Ini,${laporan.saldo_iuran_arisan.iuran_bulan_ini}`);
  lines.push(`Saldo Akhir Arisan Anggota,${laporan.saldo_iuran_arisan.saldo_akhir}`);
  lines.push(`Total Anggota Aktif,${laporan.summary.total_anggota_aktif}`);
  lines.push(`Total Pengurus Aktif,${laporan.summary.total_pengurus_aktif}`);
  lines.push(`Total Iuran Arisan Anggota,${laporan.summary.total_iuran_anggota}`);
  lines.push(`Total Iuran Konsumsi Anggota,${laporan.summary.total_iuran_konsumsi_anggota}`);
  lines.push(`Total Iuran Pengurus,${laporan.summary.total_iuran_pengurus}`);
  lines.push(`Grand Total,${laporan.summary.grand_total}`);

  const csv = "\uFEFF" + lines.join("\n"); // BOM untuk Excel
  const filename = `iuran_${tahun}_${String(bulan).padStart(2, "0")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
