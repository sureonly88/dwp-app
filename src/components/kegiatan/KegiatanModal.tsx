"use client";

import { useEffect, useState } from "react";

export interface KegiatanFormData {
  judul: string;
  deskripsi: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string;
  lokasi: string;
  kategori: string;
  status: string;
}

interface Props {
  mode: "add" | "edit";
  initialData?: KegiatanFormData & { id?: number };
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const KATEGORI_OPTIONS = ["Rapat", "Sosialisasi", "Pelatihan", "Arisan", "Bakti Sosial", "Lainnya"];
// STATUS_OPTIONS removed — status dihitung otomatis dari tanggal & waktu

const EMPTY_FORM: KegiatanFormData = {
  judul: "",
  deskripsi: "",
  tanggal: new Date().toISOString().split("T")[0],
  waktu_mulai: "09:00",
  waktu_selesai: "12:00",
  lokasi: "",
  kategori: "Rapat",
  status: "Mendatang",
};

export default function KegiatanModal({ mode, initialData, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<KegiatanFormData>(initialData ?? EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = mode === "edit" && initialData?.id ? `/api/kegiatan/${initialData.id}` : "/api/kegiatan";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Terjadi kesalahan");
        return;
      }
      onSuccess(mode === "add" ? "Kegiatan berhasil dibuat" : "Kegiatan berhasil diperbarui");
    } catch {
      setError("Gagal menyimpan kegiatan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col border border-outline-variant">
        <div className="p-6 border-b border-outline-variant flex items-center justify-between">
          <div>
            <h2 className="font-h3 text-h3 text-on-surface">
              {mode === "add" ? "Buat Kegiatan Baru" : "Edit Kegiatan"}
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              {mode === "add" ? "Isi detail acara untuk mulai mencatat presensi." : "Perbarui detail acara."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto flex-1">
          <div className="p-6 flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-error-container text-error rounded-lg text-body-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}

            <Field label="Judul Kegiatan" required>
              <input
                name="judul"
                value={form.judul}
                onChange={handleChange}
                required
                placeholder="Contoh: Rapat Pleno Bulanan"
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
              />
            </Field>

            <Field label="Deskripsi">
              <textarea
                name="deskripsi"
                value={form.deskripsi}
                onChange={handleChange}
                rows={2}
                placeholder="Detail singkat acara..."
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface resize-none"
              />
            </Field>

            <Field label="Tanggal" required>
              <input
                type="date"
                name="tanggal"
                value={form.tanggal}
                onChange={handleChange}
                required
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Waktu Mulai">
                <input
                  type="time"
                  name="waktu_mulai"
                  value={form.waktu_mulai}
                  onChange={handleChange}
                  className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </Field>
              <Field label="Waktu Selesai">
                <input
                  type="time"
                  name="waktu_selesai"
                  value={form.waktu_selesai}
                  onChange={handleChange}
                  className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </Field>
            </div>

            <Field label="Lokasi">
              <input
                name="lokasi"
                value={form.lokasi}
                onChange={handleChange}
                placeholder="Aula Serbaguna"
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Kategori">
                <select
                  name="kategori"
                  value={form.kategori}
                  onChange={handleChange}
                  style={{ paddingTop: "10px", paddingBottom: "10px" }}
                  className="w-full appearance-none border border-outline-variant rounded-lg px-4 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                >
                  {KATEGORI_OPTIONS.map((k) => <option key={k}>{k}</option>)}
                </select>
              </Field>
            </div>

            {/* Batalkan toggle */}
            <label className="flex items-center gap-3 p-3.5 border border-outline-variant rounded-xl cursor-pointer hover:bg-surface-container-low transition-colors select-none">
              <input
                type="checkbox"
                checked={form.status === "Dibatalkan"}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, status: e.target.checked ? "Dibatalkan" : "Mendatang" }))
                }
                className="w-4 h-4 rounded accent-error flex-shrink-0"
              />
              <div>
                <p className="text-label-md text-on-surface font-semibold leading-tight">Batalkan kegiatan ini</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Centang untuk menandai kegiatan sebagai Dibatalkan
                </p>
              </div>
            </label>
          </div>

          <div className="p-5 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors text-label-md font-label-md"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container shadow-sm text-label-md font-label-md disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
              {mode === "add" ? "Simpan Kegiatan" : "Perbarui"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label-md text-on-surface font-semibold">
        {label} {required && <span className="text-error">*</span>}
      </label>
      {children}
    </div>
  );
}
