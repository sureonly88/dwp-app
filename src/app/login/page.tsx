"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [username, setUsername] = useState("admin");
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
    <form onSubmit={handleSubmit} className="bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-xl p-7 flex flex-col gap-5">
      {error && (
        <div className="p-3 bg-error-container border border-error/30 text-error rounded-xl text-body-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-label-md font-semibold text-on-surface">Username</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">person</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="w-full pl-10 pr-4 py-3 border border-outline-variant rounded-xl text-body-md bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
            placeholder="admin"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-label-md font-semibold text-on-surface">Password</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">lock</span>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full pl-10 pr-11 py-3 border border-outline-variant rounded-xl text-body-md bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
            placeholder="Masukkan password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
          >
            <span className="material-symbols-outlined text-[20px]">{showPassword ? "visibility_off" : "visibility"}</span>
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-label-md hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? (
          <>
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            Memproses...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[20px]">login</span>
            Masuk Aplikasi
          </>
        )}
      </button>

      <div className="p-3 bg-primary-fixed/40 border border-primary-fixed-dim rounded-xl text-body-sm text-on-surface-variant">
        <p className="font-semibold text-on-surface mb-1">Akun awal development</p>
        <p>Username: <code className="font-mono text-primary">admin</code></p>
        <p>Password: <code className="font-mono text-primary">admin123</code></p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-fixed via-surface-container-low to-secondary-fixed/50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary text-on-primary rounded-2xl shadow-md mb-4">
            <span className="material-symbols-outlined material-symbols-filled text-[34px]">account_balance</span>
          </div>
          <h1 className="font-h2 text-h2 text-primary leading-tight">DWP Governance System</h1>
          <p className="text-body-md text-on-surface-variant mt-1">Masuk untuk mengelola data Dharma Wanita Persatuan.</p>
        </div>
        <Suspense fallback={<div className="text-center text-on-surface-variant">Memuat...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
