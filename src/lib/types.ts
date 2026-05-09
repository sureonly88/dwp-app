export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface StatCardData {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  badge?: { label: string; variant: "success" | "warning" | "error" | "neutral" };
  borderAccent?: boolean;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  month: string;
  day: number;
  location: string;
  time: string;
  colorVariant: "primary" | "secondary" | "neutral";
}

export interface Member {
  id: string;
  name: string;
  nip: string;
  jabatan: string;
  unitKerja: string;
  status: "Aktif" | "Non-Aktif" | "Cuti";
  joinDate: string;
  initials: string;
}

export interface IuranRecord {
  id: string;
  name: string;
  unit: string;
  nip: string;
  periode: string;
  nominal: string;
  tanggalBayar: string | null;
  status: "Lunas" | "Tunggakan" | "Belum Bayar";
}

export interface Activity {
  id: string;
  title: string;
  date: string;
  location: string;
  status: "Selesai" | "Berlangsung" | "Mendatang";
  hadir: number;
  total: number;
}

export interface Winner {
  rank: number;
  name: string;
  divisi: string;
  hadiah: string;
  waktu: string;
}
