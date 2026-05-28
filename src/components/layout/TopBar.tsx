"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { NAV_GROUPS } from "@/lib/data";
import { roleLabel, type SessionUser } from "@/lib/auth-token";

function getInitials(nama: string) {
  return nama.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "U";
}

function NavDropdown({ label, items, pathname }: {
  label: string;
  items: { label: string; href: string; icon: string }[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isGroupActive = items.some((i) => i.href === pathname);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (items.length === 1) {
    const item = items[0];
    const isActive = item.href === pathname;
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-1.5 px-3 h-full text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${
          isActive ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
        }`}
      >
        <span className={`material-symbols-outlined text-[18px] ${isActive ? "material-symbols-filled" : ""}`}>{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative h-full flex items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 h-full text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${
          isGroupActive || open ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
        }`}
      >
        <span className={`material-symbols-outlined text-[18px] ${isGroupActive ? "material-symbols-filled" : ""}`}>{items[0].icon}</span>
        <span>{label}</span>
        <span className={`material-symbols-outlined text-[16px] transition-transform ${open ? "rotate-180" : ""}`}>expand_more</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-0 bg-surface border border-outline-variant rounded-xl shadow-lg py-1.5 min-w-[200px] z-50">
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/60 select-none border-b border-outline-variant/50 mb-1">
            {label}
          </p>
          {items.map((item) => {
            const isActive = item.href === pathname;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${isActive ? "material-symbols-filled" : ""}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => setUser(json?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  const allowedNav = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      if (!user || user.role === "admin" || user.role === "operator") return group;
      const allowed = ["/", "/akun", "/kegiatan", "/iuran", "/arisan", "/doorprize"];
      return { ...group, items: group.items.filter((item) => allowed.includes(item.href)) };
    }).filter((g) => g.items.length > 0);
  }, [user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-40 bg-surface-container-lowest border-b border-outline-variant flex items-center shadow-sm">
      <div className="flex items-center gap-3 px-6 border-r border-outline-variant h-full flex-shrink-0">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-on-primary shadow-sm">
          <span className="material-symbols-outlined material-symbols-filled text-[18px]">account_balance</span>
        </div>
        <div className="hidden md:block">
          <h1 className="font-bold text-primary text-[13px] leading-tight">Dharma Wanita</h1>
          <p className="text-[9px] text-on-surface-variant tracking-widest uppercase">Persatuan</p>
        </div>
      </div>

      <nav className="flex items-center h-full flex-1 px-2 gap-0.5">
        {allowedNav.map((group) => (
          <NavDropdown key={group.label} label={group.label} items={group.items} pathname={pathname} />
        ))}
      </nav>

      <div className="flex items-center gap-2 px-4 flex-shrink-0">
        <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors relative">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border border-surface" />
        </button>
        <div className="h-6 w-px bg-outline-variant" />
        <div className="flex items-center gap-2">
          <div className="text-right hidden lg:block">
            <p className="font-medium text-on-surface text-[12px] leading-tight">{user?.nama ?? "Pengguna"}</p>
            <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">{user ? roleLabel(user.role) : "Memuat"}</p>
          </div>
          <Link
            href="/akun"
            title="Akun Saya / Ubah Password"
            className="w-9 h-9 rounded-full border-2 border-primary-fixed bg-secondary-fixed flex items-center justify-center text-secondary font-bold text-[12px] flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            aria-label="Akun Saya"
          >
            {user ? getInitials(user.nama) : "..."}
          </Link>
          <button onClick={handleLogout} disabled={loggingOut} title="Logout" className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error disabled:opacity-50 transition-colors">
            <span className="material-symbols-outlined text-[20px]">{loggingOut ? "progress_activity" : "logout"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
