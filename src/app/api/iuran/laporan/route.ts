import { NextRequest, NextResponse } from "next/server";
import { getLaporanIuran } from "@/lib/iuran";

// GET /api/iuran/laporan?bulan=&tahun=&unit=&pengurus=&status=
export async function GET(req: NextRequest) {
  try {
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

    return NextResponse.json(laporan);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil laporan iuran" }, { status: 500 });
  }
}
