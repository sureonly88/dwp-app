export const IURAN_UMROH_PENGURUS_NOMINAL = 1_000_000;
export const IURAN_UMROH_PENGURUS_MULAI = "2026-10-01";

export function getIuranUmrohPengurus(bulan: number, tahun: number, jumlahPengurus: number) {
  const berlaku = tahun > 2026 || (tahun === 2026 && bulan >= 10);
  const nominal = berlaku ? IURAN_UMROH_PENGURUS_NOMINAL : 0;
  return { berlaku, nominal, amount: nominal * jumlahPengurus };
}
