"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";

type Settings = Record<string, string>;

const FIELDS: { key: string; label: string; placeholder?: string; hint?: string }[] = [
  {
    key: "org_name",
    label: "Nama Organisasi",
    placeholder: "Dharma Wanita Persatuan",
  },
  {
    key: "org_sub_name",
    label: "Nama Sub Organisasi / Unit Kerja",
    placeholder: "PT. AIR MINUM BANDARMASIH (PERSERODA)",
    hint: "Digunakan sebagai nama sub organisasi pada kop undangan",
  },
  {
    key: "org_address",
    label: "Alamat Organisasi",
    placeholder: "Jalan A. Yani Km 2,5 No 12 Banjarmasin",
    hint: "Digunakan pada kop surat undangan",
  },
  {
    key: "org_city",
    label: "Kota Default",
    placeholder: "Banjarmasin",
    hint: "Digunakan pada kota penandatanganan surat",
  },
  {
    key: "org_timezone",
    label: "Zona Waktu Default",
    placeholder: "Wita",
    hint: "Contoh: WIB, Wita, WIT",
  },
  {
    key: "undangan_kepada",
    label: "Default Kepada (Undangan)",
    placeholder: "Pengurus & Anggota DWP",
    hint: "Isian default pada field Kepada di modal Cetak Undangan",
  },
  {
    key: "undangan_jabatan",
    label: "Default Jabatan Penandatangan",
    placeholder: "Ketua",
  },
  {
    key: "undangan_nomor_prefix",
    label: "Prefix Nomor Surat",
    placeholder: "DWP",
    hint: "Contoh: DWP → nomor surat menjadi DWP/001/V/2026",
  },
];

export default function PengaturanPage() {
  const [form, setForm] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Settings) => setForm(data))
      .catch(() => setError("Gagal memuat pengaturan"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const body = Object.entries(form).map(([key_name, value]) => ({ key_name, value }));
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan");
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-bold text-xl text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">settings</span>
            Pengaturan Organisasi
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Konfigurasi informasi organisasi yang digunakan di seluruh aplikasi dan dokumen cetak.
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-[32px] block mx-auto mb-2">progress_activity</span>
              Memuat pengaturan...
            </div>
          ) : (
            <div className="p-6 flex flex-col gap-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Pengaturan berhasil disimpan.
                </div>
              )}

              {FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-on-surface">{f.label}</label>
                  {f.hint && (
                    <p className="text-xs text-on-surface-variant">{f.hint}</p>
                  )}
                  <input
                    type="text"
                    value={form[f.key] ?? ""}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 border border-outline-variant rounded-xl text-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {!loading && (
            <div className="px-6 py-4 border-t border-outline-variant flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {saving ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Simpan Pengaturan
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
