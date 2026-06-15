"use client";

import { useEffect, useState } from "react";

interface UnitKerjaOption {
  id: number;
  nama: string;
  aktif: number;
}

export interface AnggotaFormData {
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  status: string;
  no_hp: string;
  email: string;
  alamat: string;
  join_date: string;
  tanggal_keluar: string;
  tanggal_pensiun: string;
}

interface AnggotaModalProps {
  mode: "add" | "edit";
  initialData?: AnggotaFormData & { id?: number };
  onClose: () => void;
  onSuccess: () => void;
}

const JABATAN_OPTIONS = [
  "Ketua",
  "Wakil Ketua",
  "Sekretaris",
  "Bendahara",
  "Ketua Bidang Pendidikan",
  "Ketua Bidang Ekonomi",
  "Ketua Sosial Budaya",
  "Anggota",
];
const STATUS_OPTIONS = ["Aktif", "Non-Aktif"];

const EMPTY_FORM: AnggotaFormData = {
  nama: "",
  nip: "",
  jabatan: "Anggota",
  unit_kerja: "Sekretariat",
  status: "Aktif",
  no_hp: "",
  email: "",
  alamat: "",
  join_date: new Date().toISOString().split("T")[0],
  tanggal_keluar: "",
  tanggal_pensiun: "",
};

export default function AnggotaModal({ mode, initialData, onClose, onSuccess }: AnggotaModalProps) {
  const [form, setForm] = useState<AnggotaFormData>(
    initialData
      ? {
          nama: initialData.nama,
          nip: initialData.nip,
          jabatan: initialData.jabatan,
          unit_kerja: initialData.unit_kerja,
          status: initialData.status,
          no_hp: initialData.no_hp ?? "",
          email: initialData.email ?? "",
          alamat: initialData.alamat ?? "",
          join_date: initialData.join_date?.split("T")[0] ?? EMPTY_FORM.join_date,
          tanggal_keluar: initialData.tanggal_keluar ? initialData.tanggal_keluar.split("T")[0] : "",
          tanggal_pensiun: initialData.tanggal_pensiun ? initialData.tanggal_pensiun.split("T")[0] : "",
        }
      : EMPTY_FORM
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitOptions, setUnitOptions] = useState<UnitKerjaOption[]>([]);

  // Fetch unit kerja dari API
  useEffect(() => {
    fetch("/api/unit-kerja")
      .then((r) => r.json())
      .then((data: UnitKerjaOption[]) => setUnitOptions(data.filter((u) => u.aktif === 1)))
      .catch(() => setUnitOptions([]));
  }, []);

  // Close on Escape
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
      const url = mode === "edit" && initialData?.id
        ? `/api/anggota/${initialData.id}`
        : "/api/anggota";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tanggal_keluar: form.tanggal_keluar ? form.tanggal_keluar : null,
          tanggal_pensiun: form.tanggal_pensiun ? form.tanggal_pensiun : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Terjadi kesalahan");
        return;
      }

      onSuccess();
    } catch {
      setError("Gagal menyimpan data. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-outline-variant">
        {/* Header */}
        <div className="p-6 border-b border-outline-variant flex items-center justify-between">
          <div>
            <h2 className="font-h3 text-h3 text-on-surface">
              {mode === "add" ? "Tambah Anggota Baru" : "Edit Data Anggota"}
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              {mode === "add" ? "Isi form di bawah untuk mendaftarkan anggota baru." : "Perbarui informasi anggota."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-0 overflow-y-auto flex-1">
          <div className="p-6 flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-error-container text-error rounded-lg text-body-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}

            {/* Nama */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label-md text-label-md text-on-surface font-semibold">
                Nama Lengkap <span className="text-error">*</span>
              </label>
              <input
                name="nama"
                value={form.nama}
                onChange={handleChange}
                required
                placeholder="Contoh: Ibu Siti Aminah"
                className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
              />
            </div>

            {/* NIP */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label-md text-label-md text-on-surface font-semibold">
                NIP / ID <span className="text-error">*</span>
              </label>
              <input
                name="nip"
                value={form.nip}
                onChange={handleChange}
                required
                placeholder="Contoh: 198205122010012001"
                className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none font-mono text-on-surface"
              />
            </div>

            {/* Jabatan & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-label-md text-on-surface font-semibold">
                  Jabatan <span className="text-error">*</span>
                </label>
                <select
                  name="jabatan"
                  value={form.jabatan}
                  onChange={handleChange}
                  required
                  style={{ paddingTop: '10px', paddingBottom: '10px' }}
                  className="appearance-none border border-outline-variant rounded-lg px-4 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                >
                  {JABATAN_OPTIONS.map((j) => <option key={j}>{j}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-label-md text-on-surface font-semibold">
                  Unit Kerja <span className="text-error">*</span>
                </label>
                <select
                  name="unit_kerja"
                  value={form.unit_kerja}
                  onChange={handleChange}
                  required
                  style={{ paddingTop: '10px', paddingBottom: '10px' }}
                  className="appearance-none border border-outline-variant rounded-lg px-4 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                >
                  {unitOptions.map((u) => <option key={u.id} value={u.nama}>{u.nama}</option>)}
                </select>
              </div>
            </div>

            {/* Status & Join Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-label-md text-on-surface font-semibold">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  style={{ paddingTop: '10px', paddingBottom: '10px' }}
                  className="appearance-none border border-outline-variant rounded-lg px-4 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-label-md text-on-surface font-semibold">Tanggal Bergabung</label>
                <input
                  type="date"
                  name="join_date"
                  value={form.join_date}
                  onChange={handleChange}
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-label-md text-on-surface font-semibold">
                  Tanggal Pensiun
                </label>
                <input
                  type="date"
                  name="tanggal_pensiun"
                  value={form.tanggal_pensiun}
                  onChange={handleChange}
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-label-md text-on-surface font-semibold">
                  Tanggal Keluar / Berhenti
                </label>
                <input
                  type="date"
                  name="tanggal_keluar"
                  value={form.tanggal_keluar}
                  onChange={handleChange}
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-body-sm text-on-surface-variant text-[11px]">
                Isi tanggal pensiun bila sudah diketahui. Kosongkan jika belum pensiun. Tanggal keluar tetap dipakai bila anggota sudah berhenti dan tidak muncul di laporan iuran mulai bulan berikutnya.
              </p>
            </div>

            {/* No HP & Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-label-md text-on-surface font-semibold">No. HP</label>
                <input
                  name="no_hp"
                  value={form.no_hp}
                  onChange={handleChange}
                  placeholder="08xxxxxxxxxx"
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-label-md text-on-surface font-semibold">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="email@domain.com"
                  className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface"
                />
              </div>
            </div>

            {/* Alamat */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label-md text-label-md text-on-surface font-semibold">Alamat</label>
              <textarea
                name="alamat"
                value={form.alamat}
                onChange={handleChange}
                rows={2}
                placeholder="Alamat lengkap..."
                className="border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm bg-surface focus:border-primary focus:outline-none text-on-surface resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-outline-variant text-on-surface-variant rounded-xl font-label-md hover:bg-surface-container transition-colors text-label-md"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary-container transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 text-label-md"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {mode === "add" ? "Tambahkan Anggota" : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
