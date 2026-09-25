import { NextRequest, NextResponse } from "next/server";
import { getArisanBelumMenerimaReport } from "@/lib/arisan-belum-menerima";

// GET /api/arisan/belum-menerima?tahun=&bulan=
export async function GET(req: NextRequest) {
  try {
    const report = await getArisanBelumMenerimaReport(new URL(req.url).searchParams);
    return NextResponse.json({
      data: report.rows,
      summary: report.summary,
    });
  } catch (error) {
    console.error("Arisan belum menerima error:", error);
    return NextResponse.json({ error: "Gagal mengambil data anggota yang belum menerima arisan" }, { status: 500 });
  }
}

