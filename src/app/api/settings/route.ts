import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-token";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/admin-auth";

export type Settings = Record<string, string | null>;

async function adminOnly(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session || session.role !== "admin") return null;
  return session;
}

// GET /api/settings
export async function GET() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT key_name, value FROM app_settings ORDER BY key_name"
    );
    const settings: Settings = {};
    for (const row of rows) {
      settings[row.key_name as string] = row.value as string | null;
    }
    return NextResponse.json(settings);
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json({ error: "Gagal mengambil pengaturan" }, { status: 500 });
  }
}

// PATCH /api/settings   body: { key_name: string, value: string }[]
export async function PATCH(req: NextRequest) {
  const session = await adminOnly(req);
  if (!session) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const { response } = await requireAdmin(req);
    if (response) return response;
    const body: { key_name: string; value: string }[] = await req.json();
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: "Body harus array of { key_name, value }" }, { status: 400 });
    }

    for (const item of body) {
      if (!item.key_name || typeof item.key_name !== "string") {
        return NextResponse.json({ error: "key_name tidak valid" }, { status: 400 });
      }
      await pool.execute<ResultSetHeader>(
        `INSERT INTO app_settings (key_name, value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [item.key_name, item.value ?? null]
      );
    }

    return NextResponse.json({ message: "Pengaturan berhasil disimpan" });
  } catch (err) {
    console.error("PATCH /api/settings error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}
