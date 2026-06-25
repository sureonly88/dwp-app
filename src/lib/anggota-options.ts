export const STATUS_KEANGGOTAAN_OPTIONS = ["Istri Karyawan", "Karyawati", "Pengurus"] as const;

export type StatusKeanggotaan = (typeof STATUS_KEANGGOTAAN_OPTIONS)[number];