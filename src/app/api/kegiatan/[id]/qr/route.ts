import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import QRCode from "qrcode";

// GET /api/kegiatan/[id]/qr  -> returns SVG QR code that links to public presensi page
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT event_code FROM kegiatan WHERE id = ? LIMIT 1",
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
    }
    const eventCode = (rows[0] as { event_code: string }).event_code;

    // Build absolute URL pointing to public presensi page
    const origin = req.nextUrl.origin;
    const url = `${origin}/presensi/${eventCode}`;

    const svg = await QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#6d181d", light: "#ffffff" },
    });

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal membuat QR" }, { status: 500 });
  }
}
