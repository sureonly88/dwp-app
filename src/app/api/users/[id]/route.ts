import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken, isUserRole } from "@/lib/auth-token";
import { getUserById, updateUser, deleteUser } from "@/lib/auth-db";
import { hashPassword } from "@/lib/password";

async function adminOnly(req: NextRequest) {
  const s = await verifySessionToken(req.cookies.get(AUTH_COOKIE_NAME)?.value);
  return s?.role === "admin" ? s : null;
}

// GET /api/users/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminOnly(req);
  if (!session) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const user = await getUserById(Number(id));
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  return NextResponse.json(user);
}

// PUT /api/users/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminOnly(req);
  if (!session) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);

  const existing = await getUserById(userId);
  if (!existing) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  const body = await req.json();
  const updates: Parameters<typeof updateUser>[1] = {};

  if (body.username !== undefined) updates.username = String(body.username).trim().toLowerCase();
  if (body.nama !== undefined) updates.nama = String(body.nama).trim();
  if (body.role !== undefined) {
    if (!isUserRole(body.role)) return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    // Prevent removing the last admin
    if (existing.role === "admin" && body.role !== "admin") {
      const { listUsers } = await import("@/lib/auth-db");
      const allUsers = await listUsers();
      const adminCount = allUsers.filter((u) => u.role === "admin" && u.aktif === 1).length;
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Tidak dapat mengubah role admin terakhir" }, { status: 400 });
      }
    }
    updates.role = body.role;
  }
  if (body.aktif !== undefined) updates.aktif = body.aktif === false || body.aktif === 0 ? 0 : 1;
  if ("anggota_id" in body) updates.anggota_id = body.anggota_id ? Number(body.anggota_id) : null;
  if (body.password) {
    if (String(body.password).length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    }
    updates.password_hash = hashPassword(String(body.password));
  }

  try {
    await updateUser(userId, updates);
    return NextResponse.json({ message: "User berhasil diperbarui" });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal memperbarui user" }, { status: 500 });
  }
}

// DELETE /api/users/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminOnly(req);
  if (!session) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);

  // Prevent self-deletion
  if (session.id === userId) {
    return NextResponse.json({ error: "Tidak dapat menghapus akun sendiri" }, { status: 400 });
  }

  const existing = await getUserById(userId);
  if (!existing) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  // Prevent deleting last admin
  if (existing.role === "admin") {
    const { listUsers } = await import("@/lib/auth-db");
    const allUsers = await listUsers();
    const adminCount = allUsers.filter((u) => u.role === "admin").length;
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Tidak dapat menghapus admin terakhir" }, { status: 400 });
    }
  }

  await deleteUser(userId);
  return NextResponse.json({ message: "User berhasil dihapus" });
}
