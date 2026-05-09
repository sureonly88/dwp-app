export type KegiatanStatus = "Mendatang" | "Berlangsung" | "Selesai" | "Dibatalkan";

/**
 * MySQL2 dengan timezone +07:00 mengembalikan kolom DATE sebagai Date object (UTC).
 * Fungsi ini mengekstrak tanggal lokal WIB sebagai string "YYYY-MM-DD".
 */
function toWIBDateStr(tanggal: string | Date): string {
  if (typeof tanggal === "string") return tanggal.slice(0, 10);
  // Date object: tambah offset +7 jam lalu ambil tanggal ISO
  const wib = new Date(tanggal.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

/**
 * Menghitung status kegiatan secara otomatis berdasarkan waktu saat ini (WIB +07:00).
 * Jika storedStatus = "Dibatalkan", dikembalikan apa adanya.
 */
export function computeKegiatanStatus(
  tanggal: string | Date,
  waktu_mulai: string | null,
  waktu_selesai: string | null,
  storedStatus: string
): KegiatanStatus {
  if (storedStatus === "Dibatalkan") return "Dibatalkan";
  const dateStr = toWIBDateStr(tanggal);
  const now = Date.now();
  const startStr = (waktu_mulai || "").slice(0, 5) || "00:00";
  const endStr = (waktu_selesai || "").slice(0, 5) || "23:59";
  const start = new Date(`${dateStr}T${startStr}:00+07:00`).getTime();
  const end = new Date(`${dateStr}T${endStr}:00+07:00`).getTime();
  if (now < start) return "Mendatang";
  if (now > end) return "Selesai";
  return "Berlangsung";
}
