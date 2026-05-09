import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-error-container text-error rounded-2xl mb-4">
          <span className="material-symbols-outlined text-[36px]">lock</span>
        </div>
        <h1 className="font-h2 text-h2 text-on-surface mb-2">Akses Ditolak</h1>
        <p className="text-body-md text-on-surface-variant mb-6">
          Role akun Anda tidak memiliki izin untuk membuka halaman atau menjalankan aksi ini.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md hover:bg-primary/90">
            Ke Dashboard
          </Link>
          <Link href="/login" className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-label-md hover:bg-surface-container">
            Ganti Akun
          </Link>
        </div>
      </div>
    </main>
  );
}
