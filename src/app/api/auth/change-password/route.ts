import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-token";
import { getAuthUserById, updateUser } from "@/lib/auth-db";
import { hashPassword, verifyPassword } from "@/lib/password";

// POST /api/auth/change-password
// Body: { currentPassword: string, newPassword: string }
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Password lama dan password baru wajib diisi" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "Password baru tidak boleh sama dengan password lama" }, { status: 400 });
  }

  const user = await getAuthUserById(session.id);
  if (!user || user.aktif !== 1) {
    return NextResponse.json({ error: "User tidak ditemukan atau non-aktif" }, { status: 404 });
  }

  if (!verifyPassword(currentPassword, user.password_hash)) {
    return NextResponse.json({ error: "Password lama tidak sesuai" }, { status: 400 });
  }

  await updateUser(user.id, { password_hash: hashPassword(newPassword) });
  return NextResponse.json({ message: "Password berhasil diubah" });
}