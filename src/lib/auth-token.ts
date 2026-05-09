export const AUTH_COOKIE_NAME = "dwp_session";

export const USER_ROLES = ["admin", "operator", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface SessionUser {
  id: number;
  username: string;
  nama: string;
  role: UserRole;
}

export interface SessionPayload extends SessionUser {
  exp: number;
}

const encoder = new TextEncoder();

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET environment variable must be set in production");
    }
    // Development only — never reaches production
    return "dev-secret-change-me-dwp-app";
  }
  return secret;
}

function base64UrlEncode(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - input.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export async function signSessionToken(user: SessionUser, maxAgeSeconds = 60 * 60 * 8) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadPart));
  return `${payloadPart}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token || !token.includes(".")) return null;
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  try {
    const key = await getSigningKey();
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signaturePart),
      encoder.encode(payloadPart)
    );
    if (!isValid) return null;

    const payloadText = new TextDecoder().decode(base64UrlDecode(payloadPart));
    const payload = JSON.parse(payloadText) as Partial<SessionPayload>;
    if (
      typeof payload.id !== "number" ||
      typeof payload.username !== "string" ||
      typeof payload.nama !== "string" ||
      !isUserRole(payload.role) ||
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function roleLabel(role: UserRole) {
  switch (role) {
    case "admin": return "Admin";
    case "operator": return "Operator";
    case "viewer": return "Viewer";
  }
}
