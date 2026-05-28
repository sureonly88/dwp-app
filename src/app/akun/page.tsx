"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import type { SessionUser } from "@/lib/auth-token";

export default function AkunPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => setUser(json?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setMessage({ type: "error", text: "Semua field password wajib diisi" });
      return;
    }
    if (form.newPassword.length < 6) {
      setMessage({ type: "error", text: "Password baru minimal 6 karakter" });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setMessage({ type: "error", text: "Konfirmasi password tidak sama" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error ?? "Gagal mengubah password" });
        return;
      }
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage({ type: "success", text: "Password berhasil diubah" });
    } catch {
      setMessage({ type: "error", text: "Gagal mengubah password. Coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Akun Saya</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Kelola keamanan akun dan ubah password login Anda.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center text-primary font-bold text-lg">
              {user?.nama.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() ?? "U"}
            </div>
            <div>
              <p className="font-semibold text-on-surface">{user?.nama ?? "Memuat..."}</p>
              <p className="text-sm text-on-surface-variant">@{user?.username ?? "-"}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5">
            <h2 className="font-semibold text-on-surface">Ubah Password</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Masukkan password lama untuk mengonfirmasi perubahan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                message.type === "success"
                  ? "bg-tertiary-container text-on-tertiary-container"
                  : "bg-error-container text-on-error-container"
              }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {message.type === "success" ? "check_circle" : "error"}
                </span>
                {message.text}
              </div>
            )}

            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">
                Password Lama <span className="text-error">*</span>
              </label>
              <input
                type="password"
                value={form.currentPassword}
                onChange={(e) => updateField("currentPassword", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">
                Password Baru <span className="text-error">*</span>
              </label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => updateField("newPassword", e.target.value)}
                placeholder="Min. 6 karakter"
                className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">
                Konfirmasi Password Baru <span className="text-error">*</span>
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                autoComplete="new-password"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                Simpan Password
              </button>
            </div>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}