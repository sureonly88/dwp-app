import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken, isUserRole } from "@/lib/auth-token";
import { listUsers, createUser } from "@/lib/auth-db";
import { hashPassword } from "@/lib/password";

function adminOnly(req: NextRequest) {
  return verifySessionToken(req.cookies.get(AUTH_COOKIE_NAME)?.value).then((s) => {
    if (!s || s.role !== "admin") return null;
    return s;
  });
}

// GET /api/users?search=
export async function GET(req: NextRequest) {
  const session = await adminOnly(req);
  if (!session) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const search = new URL(req.url).searchParams.get("search") ?? "";
  const users = await listUsers(search);
  return NextResponse.json({ data: users });
}

// POST /api/users
export async function POST(req: NextRequest) {
  const session = await adminOnly(req);
  if (!session) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const body = await req.json();
  const username = String(body.username ?? "").trim().toLowerCase();
  const nama = String(body.nama ?? "").trim();
  const password = String(body.password ?? "");
  const role = body.role;
  const aktif = body.aktif === false || body.aktif === 0 ? 0 : 1;
  const anggota_id: number | null = body.anggota_id ? Number(body.anggota_id) : null;

  if (!username || !nama || !password || !isUserRole(role)) {
    return NextResponse.json({ error: "Field wajib tidak lengkap atau role tidak valid" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  try {
    const password_hash = hashPassword(password);
    const id = await createUser({ username, nama, password_hash, role, aktif, anggota_id });
    return NextResponse.json({ id, message: "User berhasil dibuat" }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal membuat user" }, { status: 500 });
  }
}
