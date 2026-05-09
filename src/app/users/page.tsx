"use client";

import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import UserModal, { type UserFormData } from "@/components/users/UserModal";
import { FetchErrorBox } from "@/components/ui/FetchError";

interface User {
  id: number;
  username: string;
  nama: string;
  role: "admin" | "operator" | "viewer";
  aktif: number;
  anggota_id: number | null;
  anggota_nama: string | null;
  anggota_nip: string | null;
  anggota_unit_kerja: string | null;
  last_login_at: string | null;
  created_at: string;
}

const ROLE_BADGE: Record<string, "success" | "warning" | "neutral" | "error"> = {
  admin: "error",
  operator: "warning",
  viewer: "neutral",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  operator: "Operator",
  viewer: "Viewer",
};

function getInitials(nama: string) {
  return nama.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function UsersPage() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [editTarget, setEditTarget] = useState<(UserFormData & { id: number }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/users?search=${encodeURIComponent(search)}`);
      if (res.status === 403) { window.location.href = "/unauthorized"; return; }
      const json = await res.json();
      setData(json.data ?? []);
    } catch {
      setFetchError(true);
      showToast("Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openEdit(user: User) {
    setEditTarget({
      id: user.id,
      username: user.username,
      nama: user.nama,
      password: "",
      role: user.role,
      aktif: user.aktif === 1,
      anggota_id: user.anggota_id,
    });
    setModal("edit");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Gagal menghapus", "error"); return; }
      showToast("User berhasil dihapus");
      setDeleteTarget(null);
      fetchData();
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredLocal = data.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.nama.toLowerCase().includes(q) ||
      (u.anggota_nama ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-tertiary-container text-on-tertiary-container"
              : "bg-error-container text-on-error-container"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      {/* Modal */}
      {modal === "add" && (
        <UserModal mode="add" onClose={() => setModal(null)} onSuccess={() => { showToast("User berhasil dibuat"); fetchData(); }} />
      )}
      {modal === "edit" && editTarget && (
        <UserModal
          mode="edit"
          initialData={editTarget}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onSuccess={() => { showToast("User berhasil diperbarui"); fetchData(); }}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-[24px]">person_remove</span>
            </div>
            <h3 className="text-center font-semibold text-on-surface mb-1">Hapus User</h3>
            <p className="text-center text-sm text-on-surface-variant mb-5">
              Hapus user <strong>{deleteTarget.nama}</strong> ({deleteTarget.username})? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline text-on-surface text-sm font-medium hover:bg-surface-container transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl bg-error text-on-error text-sm font-medium hover:bg-error/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleteLoading && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Manajemen User</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Kelola akun login dan hak akses sistem
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setModal("add")}
            icon="person_add"
          >
            Tambah User
          </Button>
        </div>

        {/* Search */}
        <Card className="p-4">
          <div className="relative max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari username atau nama..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              <span className="text-sm">Memuat data...</span>
            </div>
          ) : fetchError ? (
            <FetchErrorBox message="Gagal memuat data user. Periksa koneksi dan coba lagi." onRetry={fetchData} />
          ) : filteredLocal.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px] mb-2">manage_accounts</span>
              <p className="text-sm">Tidak ada user ditemukan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container/50">
                    <th className="text-left px-4 py-3 text-on-surface-variant font-medium">User</th>
                    <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Role</th>
                    <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Terhubung Anggota</th>
                    <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Login Terakhir</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {filteredLocal.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-container/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                            {getInitials(user.nama)}
                          </div>
                          <div>
                            <p className="font-medium text-on-surface">{user.nama}</p>
                            <p className="text-xs text-on-surface-variant">@{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_BADGE[user.role] ?? "neutral"} label={ROLE_LABEL[user.role] ?? user.role} />
                      </td>
                      <td className="px-4 py-3">
                        {user.anggota_nama ? (
                          <div>
                            <p className="text-on-surface">{user.anggota_nama}</p>
                            <p className="text-xs text-on-surface-variant">{user.anggota_nip} · {user.anggota_unit_kerja}</p>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant text-xs italic">Belum ditautkan</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.aktif === 1 ? "success" : "neutral"} label={user.aktif === 1 ? "Aktif" : "Non-Aktif"} />
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant text-xs">
                        {formatDate(user.last_login_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(user)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-highest hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(user)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                            title="Hapus"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total User", value: data.length, icon: "group", color: "text-primary" },
            { label: "Admin", value: data.filter((u) => u.role === "admin").length, icon: "admin_panel_settings", color: "text-error" },
            { label: "Operator", value: data.filter((u) => u.role === "operator").length, icon: "manage_accounts", color: "text-warning" },
            { label: "Terhubung Anggota", value: data.filter((u) => u.anggota_id !== null).length, icon: "link", color: "text-tertiary" },
          ].map((s) => (
            <Card key={s.label} className="p-4 flex items-center gap-3">
              <span className={`material-symbols-outlined text-[24px] ${s.color}`}>{s.icon}</span>
              <div>
                <p className="text-lg font-bold text-on-surface">{s.value}</p>
                <p className="text-xs text-on-surface-variant">{s.label}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
