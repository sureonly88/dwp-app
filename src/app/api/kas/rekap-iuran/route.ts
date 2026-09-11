import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/kas";
import { getRekapIuranKas } from "@/lib/kas-rekap-iuran";

// GET /api/kas/rekap-iuran?bulan_awal=&tahun_awal=&bulan_akhir=&tahun_akhir=
export async function GET(req: NextRequest) {
  const { response } = await requireSession(req);
  if (response) return response;

  try {
    const laporan = await getRekapIuranKas(new URL(req.url).searchParams);
    return NextResponse.json(laporan);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengambil rekap iuran";
    const status = message.includes("Periode awal") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
