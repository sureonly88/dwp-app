import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireSession, requireAdmin } from "@/lib/kas";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface CategoryRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  type: "income" | "expense";
  is_system: number;
  active: number;
  description: string | null;
}

// GET /api/kas/kategori?type=income|expense&active=1
export async function GET(req: NextRequest) {
  const { response } = await requireSession(req);
  if (response) return response;

  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");
  const activeOnly = sp.get("active") === "1";

  const where: string[] = [];
  const args: (string | number)[] = [];
  if (type === "income" || type === "expense") {
    where.push("type = ?");
    args.push(type);
  }
  if (activeOnly) where.push("active = 1");

  const [rows] = await pool.execute<CategoryRow[]>(
    `SELECT id, code, name, type, is_system, active, description
     FROM cash_categories
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY type ASC, name ASC`,
    args
  );

  return NextResponse.json({ data: rows });
}

// POST /api/kas/kategori — admin only
export async function POST(req: NextRequest) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  try {
    const body = await req.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim();
    const type = body.type;
    const description = body.description ? String(body.description).trim() : null;

    if (!code || !name) {
      return NextResponse.json({ error: "Kode dan nama wajib diisi" }, { status: 400 });
    }
    if (type !== "income" && type !== "expense") {
      return NextResponse.json({ error: "Tipe harus income atau expense" }, { status: 400 });
    }

    const [r] = await pool.execute<ResultSetHeader>(
      `INSERT INTO cash_categories (code, name, type, description) VALUES (?,?,?,?)`,
      [code, name, type, description]
    );
    return NextResponse.json({ id: r.insertId }, { status: 201 });
  } catch (e) {
    const msg = (e as { code?: string }).code === "ER_DUP_ENTRY"
      ? "Kode kategori sudah digunakan"
      : "Gagal menyimpan kategori";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
