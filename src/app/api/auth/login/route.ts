import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, signSessionToken } from "@/lib/auth-token";
import { findActiveUserByUsername, touchLastLogin } from "@/lib/auth-db";
import { verifyPassword } from "@/lib/password";

const SESSION_MAX_AGE = 60 * 60 * 8;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json({ error: "Username dan password wajib diisi" }, { status: 400 });
    }

    const user = await findActiveUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "Username atau password salah" }, { status: 401 });
    }

    const sessionUser = { id: user.id, username: user.username, nama: user.nama, role: user.role };
    const token = await signSessionToken(sessionUser, SESSION_MAX_AGE);
    await touchLastLogin(user.id);

    const res = NextResponse.json({ user: sessionUser });
    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Gagal login" }, { status: 500 });
  }
}
