"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Login gagal");
        return;
      }
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-800">Username</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">person</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-[#7b1fa2] focus:outline-none focus:ring-2 focus:ring-[#7b1fa2]/20 text-gray-900 transition-all"
            placeholder="Masukkan username"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-800">Password</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">lock</span>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-[#7b1fa2] focus:outline-none focus:ring-2 focus:ring-[#7b1fa2]/20 text-gray-900 transition-all"
            placeholder="Masukkan password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#7b1fa2] transition-colors"
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
          >
            <span className="material-symbols-outlined text-[20px]">{showPassword ? "visibility_off" : "visibility"}</span>
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-1"
        style={{ background: "linear-gradient(135deg, #6a1b9a 0%, #4527a0 100%)" }}
      >
        {loading ? (
          <>
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            Memproses...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[20px]">login</span>
            Masuk
          </>
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex">
      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[55%] relative overflow-hidden p-10"
        style={{ background: "linear-gradient(145deg, #4a148c 0%, #6a1b9a 40%, #8e24aa 70%, #c2185b 100%)" }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full opacity-20" style={{ background: "rgba(255,255,255,0.15)" }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-15" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="absolute top-1/2 right-[-40px] w-40 h-40 rounded-full opacity-10" style={{ background: "rgba(255,255,255,0.2)" }} />

        {/* Top: Brand */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 bg-white/15 backdrop-blur-sm px-4 py-2 rounded-2xl mb-8">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]" style={{ color: "#6a1b9a" }}>account_balance</span>
            </div>
            <span className="text-white font-semibold text-sm">DWP PAM Bandarmasih</span>
          </div>

          <h1 className="text-white font-bold leading-tight mb-4" style={{ fontSize: "2.4rem" }}>
            Sistem Manajemen<br />Digital DWP
          </h1>
          <p className="text-white/80 text-base leading-relaxed max-w-sm">
            Kelola keanggotaan, kegiatan, keuangan, dan laporan Dharma Wanita Persatuan dalam satu platform terpadu.
          </p>
        </div>

        {/* Center: Photo card */}
        <div className="relative z-10 flex-1 flex items-center justify-center py-6">
          <div className="relative w-full max-w-md">
            {/* Decorative frame */}
            <div className="absolute -inset-3 rounded-3xl opacity-30" style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }} />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/30"
              style={{ aspectRatio: "16/10" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/foto-pertemuan.jpg"
                alt="Pertemuan Rutin DWP PAM Bandarmasih"
                className="w-full h-full object-cover object-top"
              />
              {/* Gradient overlay on photo */}
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(74,20,140,0.6) 0%, transparent 50%)" }} />
              {/* Caption on photo */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white font-bold text-sm drop-shadow">Pertemuan Rutin DWP</p>
                <p className="text-white/80 text-xs drop-shadow">PT. Air Minum Bandarmasih (Perseroda)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Stats */}
        <div className="relative z-10 flex items-center gap-0 divide-x divide-white/20">
          {[
            { value: "100+", label: "Anggota Aktif" },
            { value: "12x", label: "Pertemuan/Tahun" },
            { value: "100%", label: "Digital" },
          ].map((s) => (
            <div key={s.label} className="flex-1 text-center px-4">
              <p className="text-white font-bold text-2xl">{s.value}</p>
              <p className="text-white/70 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6a1b9a, #4527a0)" }}>
              <span className="material-symbols-outlined text-white text-[18px]">account_balance</span>
            </div>
            <span className="font-bold text-gray-800">DWP PAM Bandarmasih</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Selamat Datang! 👋</h2>
            <p className="text-gray-500 text-sm">Masuk ke akun Anda untuk mengakses dashboard DWP.</p>
          </div>

          <Suspense fallback={<div className="text-center text-gray-400">Memuat...</div>}>
            <LoginForm />
          </Suspense>

          <p className="text-center text-xs text-gray-400 mt-8">
            © 2026 DWP PAM Bandarmasih &mdash; Sistem Manajemen Digital
          </p>
        </div>
      </div>
    </main>
  );
}
