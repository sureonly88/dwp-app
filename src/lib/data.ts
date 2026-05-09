import type { NavGroup, StatCardData, Event, Member, IuranRecord, Activity, Winner } from "./types";

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Umum",
    items: [
      { label: "Dashboard", href: "/", icon: "dashboard" },
    ],
  },
  {
    label: "Data Anggota",
    items: [
      { label: "Keanggotaan", href: "/keanggotaan", icon: "group" },
      { label: "Unit Kerja", href: "/unit-kerja", icon: "corporate_fare" },
    ],
  },
  {
    label: "Kegiatan",
    items: [
      { label: "Kegiatan & Presensi", href: "/kegiatan", icon: "event_available" },
      { label: "Iuran Anggota", href: "/iuran", icon: "account_balance_wallet" },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { label: "Dashboard Kas", href: "/kas", icon: "account_balance" },
      { label: "Transaksi Kas", href: "/kas/transaksi", icon: "receipt_long" },
      { label: "Buku Kas", href: "/kas/buku", icon: "menu_book" },
      { label: "Posting Iuran", href: "/kas/posting-iuran", icon: "post_add" },
      { label: "Penjualan Barang", href: "/kas/penjualan", icon: "storefront" },
      { label: "Kategori Kas", href: "/kas/kategori", icon: "category" },
      { label: "Laporan Bulanan", href: "/kas/laporan", icon: "summarize" },
    ],
  },
  {
    label: "Program",
    items: [
      { label: "Arisan", href: "/arisan", icon: "savings" },
      { label: "Doorprize", href: "/doorprize", icon: "card_giftcard" },
    ],
  },
  {
    label: "Administrasi",
    items: [
      { label: "Manajemen User", href: "/users", icon: "manage_accounts" },
    ],
  },
];

export const DASHBOARD_STATS: StatCardData[] = [
  {
    title: "Total Anggota",
    value: "1.240",
    subtitle: "Terdaftar di database pusat",
    icon: "groups",
    iconBg: "bg-primary-fixed",
    iconColor: "text-primary",
    badge: { label: "+5.2%", variant: "success" },
  },
  {
    title: "Total Pengurus",
    value: "86",
    subtitle: "Aktif di periode 2024",
    icon: "shield_person",
    iconBg: "bg-secondary-fixed",
    iconColor: "text-secondary",
    badge: { label: "Stabil", variant: "neutral" },
  },
  {
    title: "Kegiatan Bulan Ini",
    value: "12",
    subtitle: "Rapat & bakti sosial",
    icon: "event_available",
    iconBg: "bg-tertiary-fixed",
    iconColor: "text-tertiary",
    badge: { label: "+12%", variant: "success" },
  },
  {
    title: "Saldo Arisan",
    value: "Rp 15.4Jt",
    subtitle: "Update per 15 Mei 2024",
    icon: "payments",
    iconBg: "bg-secondary-container",
    iconColor: "text-secondary",
    badge: { label: "-2.4%", variant: "error" },
    borderAccent: true,
  },
];

export const UPCOMING_EVENTS: Event[] = [
  {
    id: "1",
    title: "Rapat Pleno Bulanan",
    date: "22 Mei 2024",
    month: "MEI",
    day: 22,
    location: "Ruang Aula Pusat",
    time: "09:00 WIB",
    colorVariant: "primary",
  },
  {
    id: "2",
    title: "Bakti Sosial Stunting",
    date: "25 Mei 2024",
    month: "MEI",
    day: 25,
    location: "Kec. Mampang",
    time: "08:00 WIB",
    colorVariant: "secondary",
  },
  {
    id: "3",
    title: "Seminar Parenting",
    date: "2 Jun 2024",
    month: "JUN",
    day: 2,
    location: "Zoom Meeting",
    time: "14:00 WIB",
    colorVariant: "neutral",
  },
];

export const BAR_CHART_DATA = [
  { label: "Jan", heightPercent: 60 },
  { label: "Feb", heightPercent: 75 },
  { label: "Mar", heightPercent: 45 },
  { label: "Apr", heightPercent: 90 },
  { label: "Mei", heightPercent: 65 },
  { label: "Jun", heightPercent: 82 },
];

export const MEMBERS: Member[] = [
  { id: "1", name: "Riana Setyawati", nip: "198205122010012001", jabatan: "Pengurus", unitKerja: "Pendidikan", status: "Aktif", joinDate: "Jan 2023", initials: "RS" },
  { id: "2", name: "Siti Aminah", nip: "197804152008012002", jabatan: "Ketua", unitKerja: "Sekretariat", status: "Aktif", joinDate: "Mar 2022", initials: "SA" },
  { id: "3", name: "Dewi Rahayu", nip: "198510202012012003", jabatan: "Anggota", unitKerja: "Sosial Budaya", status: "Aktif", joinDate: "Jun 2023", initials: "DR" },
  { id: "4", name: "Lusi Kurniawati", nip: "199001082015012004", jabatan: "Anggota", unitKerja: "Ekonomi", status: "Cuti", joinDate: "Feb 2024", initials: "LK" },
  { id: "5", name: "Farida Ratnasari", nip: "198303192011012005", jabatan: "Pengurus", unitKerja: "Pendidikan", status: "Aktif", joinDate: "Jan 2023", initials: "FR" },
  { id: "6", name: "Endang Sri Rejeki", nip: "198212172009012006", jabatan: "Anggota", unitKerja: "Kesehatan", status: "Non-Aktif", joinDate: "Apr 2022", initials: "ES" },
  { id: "7", name: "Nurhasanah", nip: "199205032018012007", jabatan: "Anggota", unitKerja: "Ekonomi", status: "Aktif", joinDate: "Sep 2023", initials: "NH" },
  { id: "8", name: "Wahyuni Pratiwi", nip: "198708142013012008", jabatan: "Pengurus", unitKerja: "Sekretariat", status: "Aktif", joinDate: "Jul 2023", initials: "WP" },
];

export const IURAN_RECORDS: IuranRecord[] = [
  { id: "1", name: "Farida Ratnasari", unit: "Unit Pendidikan", nip: "19850312001", periode: "Januari 2024", nominal: "Rp 50.000", tanggalBayar: "12 Jan 2024", status: "Lunas" },
  { id: "2", name: "Endang Sri Rejeki", unit: "Unit Kesehatan", nip: "19821015004", periode: "Januari 2024", nominal: "Rp 50.000", tanggalBayar: null, status: "Tunggakan" },
  { id: "3", name: "Siti Aminah", unit: "Unit Sekretariat", nip: "19780415002", periode: "Januari 2024", nominal: "Rp 50.000", tanggalBayar: "10 Jan 2024", status: "Lunas" },
  { id: "4", name: "Dewi Rahayu", unit: "Unit Sosial Budaya", nip: "19851020003", periode: "Januari 2024", nominal: "Rp 50.000", tanggalBayar: null, status: "Belum Bayar" },
  { id: "5", name: "Lusi Kurniawati", unit: "Unit Ekonomi", nip: "19900108005", periode: "Januari 2024", nominal: "Rp 50.000", tanggalBayar: "15 Jan 2024", status: "Lunas" },
  { id: "6", name: "Nurhasanah", unit: "Unit Ekonomi", nip: "19920503006", periode: "Januari 2024", nominal: "Rp 50.000", tanggalBayar: null, status: "Tunggakan" },
  { id: "7", name: "Wahyuni Pratiwi", unit: "Unit Sekretariat", nip: "19870814007", periode: "Januari 2024", nominal: "Rp 50.000", tanggalBayar: "11 Jan 2024", status: "Lunas" },
];

export const ACTIVITIES: Activity[] = [
  { id: "1", title: "Rapat Pleno Bulanan & Sosialisasi Kesehatan", date: "22 Mei 2024", location: "Aula Serbaguna", status: "Berlangsung", hadir: 84, total: 120 },
  { id: "2", title: "Bakti Sosial Stunting", date: "25 Mei 2024", location: "Kec. Mampang", status: "Mendatang", hadir: 0, total: 80 },
  { id: "3", title: "Pelatihan Kewirausahaan", date: "10 Mei 2024", location: "Ruang Seminar B", status: "Selesai", hadir: 65, total: 70 },
  { id: "4", title: "Seminar Parenting", date: "2 Jun 2024", location: "Zoom Meeting", status: "Mendatang", hadir: 0, total: 100 },
  { id: "5", title: "Rapat Koordinasi DWP Pusat", date: "5 Mei 2024", location: "Ruang Rapat 1", status: "Selesai", hadir: 32, total: 35 },
];

export const WINNERS: Winner[] = [
  { rank: 1, name: "Ibu Siti Aminah", divisi: "Divisi Pendidikan", hadiah: "Logam Mulia", waktu: "10:45 WIB" },
  { rank: 2, name: "Ibu Lusi Rahayu", divisi: "Divisi Sosial", hadiah: "Voucher Belanja", waktu: "10:52 WIB" },
  { rank: 3, name: "Ibu Dewi Rahayu", divisi: "Divisi Kesehatan", hadiah: "Paket Elektronik", waktu: "11:05 WIB" },
  { rank: 4, name: "Ibu Farida Wahyu", divisi: "Divisi Ekonomi", hadiah: "Paket Sembako", waktu: "11:20 WIB" },
];
