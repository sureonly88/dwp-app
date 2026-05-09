import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-token";

export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  return NextResponse.json({
    user: {
      id: session.id,
      username: session.username,
      nama: session.nama,
      role: session.role,
    },
  });
}
