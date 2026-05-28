import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "./auth-token";

export async function requireAdmin(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Belum login" }, { status: 401 }) };
  }
  if (req.nextUrl.pathname.startsWith("/api/kas") && session.role === "operator") {
    return { session, response: null };
  }
  if (session.role !== "admin") {
    return { session: null, response: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }) };
  }
  return { session, response: null };
}