"use client";

import { useEffect, useState } from "react";

interface AnggotaOption {
  id: number;
  nama: string;
  nip: string;
  unit_kerja: string;
}

export interface UserFormData {
  username: string;
  nama: string;
  password: string;
  role: string;
  aktif: boolean;
  anggota_id: number | null;
}

interface UserModalProps {
  mode: "add" | "edit";
  initialData?: Partial<UserFormData> & { id?: number };
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", desc: "Akses penuh ke semua fitur" },
  { value: "operator", label: "Operator", desc: "Kelola data kecuali manajemen user" },
  { value: "viewer", label: "Viewer", desc: "Hanya bisa melihat data" },
];

const EMPTY_FORM: UserFormData = {
  username: "",
  nama: "",
  password: "",
  role: "viewer",
  aktif: true,
  anggota_id: null,
};

export default function UserModal({ mode, initialData, onClose, onSuccess }: UserModalProps) {
  const [form, setForm] = useState<UserFormData>(
    initialData
      ? {
          username: initialData.username ?? "",
          nama: initialData.nama ?? "",
          password: "",
          role: initialData.role ?? "viewer",
          aktif: initialData.aktif ?? true,
          anggota_id: initialData.anggota_id ?? null,
        }
      : EMPTY_FORM
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anggotaOptions, setAnggotaOptions] = useState<AnggotaOption[]>([]);
  const [anggotaSearch, setAnggotaSearch] = useState("");
  const [showAnggotaDropdown, setShowAnggotaDropdown] = useState(false);

  // Fetch anggota list
  useEffect(() => {
    fetch("/api/anggota?limit=200&status=Aktif")
      .then((r) => r.json())
      .then((d: { data: AnggotaOption[] }) => setAnggotaOptions(d.data ?? []))
      .catch(() => setAnggotaOptions([]));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const selectedAnggota = anggotaOptions.find((a) => a.id === form.anggota_id) ?? null;

  const filteredAnggota = anggotaOptions.filter((a) => {
    const q = anggotaSearch.toLowerCase();
    return a.nama.toLowerCase().includes(q) || a.nip.toLowerCase().includes(q);
  }).slice(0, 10);

  function set(key: keyof UserFormData, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.username.trim() || !form.nama.trim()) {
      setError("Username dan nama wajib diisi");
      return;
    }
    if (mode === "add" && !form.password) {
      setError("Password wajib diisi saat membuat user baru");
      return;
    }
    if (form.password && form.password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim().toLowerCase(),
        nama: form.nama.trim(),
        role: form.role,
        aktif: form.aktif ? 1 : 0,
        anggota_id: form.anggota_id,
      };
      if (form.password) payload.password = form.password;

      const url = mode === "add" ? "/api/users" : `/api/users/${initialData?.id}`;
      const method = mode === "add" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Terjadi kesalahan"); return; }
      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="font-semibold text-on-surface text-base">
            {mode === "add" ? "Tambah User Baru" : "Edit User"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-label-sm text-on-surface-variant mb-1">
              Username <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              placeholder="contoh: budi.santoso"
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>

          {/* Nama */}
          <div>
            <label className="block text-label-sm text-on-surface-variant mb-1">
              Nama Lengkap <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.nama}
              onChange={(e) => set("nama", e.target.value)}
              placeholder="Nama lengkap user"
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-label-sm text-on-surface-variant mb-1">
              Password {mode === "add" && <span className="text-error">*</span>}
              {mode === "edit" && <span className="text-on-surface-variant text-xs ml-1">(kosongkan jika tidak diubah)</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={mode === "add" ? "Min. 6 karakter" : "Isi untuk ganti password"}
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-label-sm text-on-surface-variant mb-1">
              Role <span className="text-error">*</span>
            </label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.role === r.value
                      ? "border-primary bg-primary-container/30"
                      : "border-outline-variant hover:bg-surface-container"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={form.role === r.value}
                    onChange={() => set("role", r.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium text-on-surface">{r.label}</p>
                    <p className="text-xs text-on-surface-variant">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Link ke Anggota */}
          <div className="relative">
            <label className="block text-label-sm text-on-surface-variant mb-1">
              Tautkan ke Anggota
              <span className="text-on-surface-variant text-xs ml-1">(opsional)</span>
            </label>
            {selectedAnggota ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary bg-primary-container/20">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{selectedAnggota.nama}</p>
                  <p className="text-xs text-on-surface-variant">{selectedAnggota.nip} · {selectedAnggota.unit_kerja}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { set("anggota_id", null); setAnggotaSearch(""); }}
                  className="text-on-surface-variant hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={anggotaSearch}
                  onChange={(e) => { setAnggotaSearch(e.target.value); setShowAnggotaDropdown(true); }}
                  onFocus={() => setShowAnggotaDropdown(true)}
                  onBlur={() => setTimeout(() => setShowAnggotaDropdown(false), 150)}
                  placeholder="Cari nama atau NIP anggota..."
                  className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
                {showAnggotaDropdown && filteredAnggota.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredAnggota.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={() => { set("anggota_id", a.id); setAnggotaSearch(""); setShowAnggotaDropdown(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-surface-container transition-colors"
                      >
                        <p className="text-sm text-on-surface">{a.nama}</p>
                        <p className="text-xs text-on-surface-variant">{a.nip} · {a.unit_kerja}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status Aktif */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.aktif}
              onClick={() => set("aktif", !form.aktif)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.aktif ? "bg-primary" : "bg-outline"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.aktif ? "translate-x-5.5 left-0.5" : "left-0.5"
                }`}
              />
            </button>
            <span className="text-sm text-on-surface">
              {form.aktif ? "User Aktif" : "User Non-Aktif"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-outline text-on-surface font-medium text-sm hover:bg-surface-container transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
              {mode === "add" ? "Buat User" : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
