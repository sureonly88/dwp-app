import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, type UserRole, verifySessionToken } from "@/lib/auth-token";

const PUBLIC_PAGE_PREFIXES = ["/login", "/presensi", "/unauthorized"];
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/presensi"];

function isPublicPage(pathname: string) {
  return PUBLIC_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicApi(pathname: string, method: string) {
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  // Public presensi page allows non-member guests to submit attendance without login.
  // Keep GET/DELETE protected because those endpoints are used by admin kegiatan detail.
  return method === "POST" && /^\/api\/kegiatan\/\d+\/presensi\/tamu$/.test(pathname);
}

function pageRoles(pathname: string): UserRole[] | null {
  if (
    pathname.startsWith("/keanggotaan") ||
    pathname.startsWith("/unit-kerja") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/pengaturan") ||
    pathname.startsWith("/kas")
  ) return ["admin", "operator"];
  if (pathname.startsWith("/iuran")) return ["admin", "operator", "viewer"];
  if (pathname.startsWith("/kegiatan") || pathname.startsWith("/arisan") || pathname.startsWith("/doorprize")) {
    return ["admin", "operator", "viewer"];
  }
  return null;
}

function apiRoles(pathname: string, method: string): UserRole[] | null {
  if (method === "GET") {
    if (pathname.startsWith("/api/iuran")) return ["admin", "operator", "viewer"];
    return ["admin", "operator", "viewer"];
  }

  if (pathname.startsWith("/api/kas")) return ["admin", "operator"];

  return ["admin"];
}

function forbiddenResponse(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/unauthorized", req.url));
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if ((isApi && isPublicApi(pathname, req.method)) || (!isApi && isPublicPage(pathname))) {
    return NextResponse.next();
  }

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Belum login" }, { status: 401 });
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const allowedRoles = isApi ? apiRoles(pathname, req.method) : pageRoles(pathname);
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return forbiddenResponse(req);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-dwp-user-id", String(session.id));
  requestHeaders.set("x-dwp-user-role", session.role);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
