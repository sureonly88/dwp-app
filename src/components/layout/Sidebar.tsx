"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/lib/data";
import { useSidebar } from "./SidebarContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 bg-[#ffe4ef] border-r border-[#f5b8cd] flex flex-col overflow-hidden transition-all duration-300 ${
        collapsed ? "w-16" : "w-[280px]"
      }`}
    >
      {/* Batik decorative overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuDgF91ZDJR8CjRpaHNU5H6gKS3C4v6tYzUP88FEdV6Q0qQzHUcBTk9oM9Has_pBKZuZmoPik86J4A02opTxOamxEWuL8LeP3libCnl_E3Z5myhDFY7M90PCVzSZsXhviOGeCAgi-1Z3koA6hwi4MYsMh7DWfybvIQiLgJ1egi1-f2UPe4NqSxOz9S3BkJIY7P0b9Tug_RAUm-wi16aDncMlan7brx5nqlaoIwmCo2BfgNI52dvrJWaa4pLJIPyXjY6nBfzf_qbN1dfA)] bg-cover" />

      {/* Header */}
      <div className={`relative z-10 pt-5 pb-4 flex items-center border-b border-outline-variant/50 ${
        collapsed ? "justify-center px-0" : "px-5 gap-3"
      }`}>
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-on-primary shadow-sm flex-shrink-0">
          <span className="material-symbols-outlined material-symbols-filled text-[22px]">account_balance</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-h3 text-h3 font-bold text-primary leading-tight text-base whitespace-nowrap">
              Dharma Wanita
            </h1>
            <p className="text-label-sm text-on-surface-variant tracking-widest uppercase text-[10px] whitespace-nowrap">
              Persatuan
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 relative z-10 py-3 overflow-y-auto ${
        collapsed ? "px-1 space-y-0.5" : "px-3"
      }`}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={collapsed ? "" : gi > 0 ? "mt-4" : ""}>
            {/* Group label — hidden when collapsed */}
            {!collapsed && (
              <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/60 select-none">
                {group.label}
              </p>
            )}
            {collapsed && gi > 0 && (
              <div className="my-1.5 mx-1 border-t border-outline-variant/40" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 font-label-md text-label-md ${
                      collapsed ? "justify-center px-0" : "px-3"
                    } ${
                      isActive
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[22px] flex-shrink-0 ${
                      isActive ? "material-symbols-filled" : ""
                    }`}>
                      {item.icon}
                    </span>
                    {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Add New Button */}
      {!collapsed && (
        <div className="relative z-10 px-4 pt-4">
          <button className="w-full py-3 bg-primary text-on-primary rounded-xl font-label-md shadow-sm flex items-center justify-center gap-2 hover:bg-primary-container transition-colors active:scale-[0.98]">
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Tambah Data Baru
          </button>
        </div>
      )}

      {/* Footer Links */}
      <div className={`relative z-10 py-3 space-y-0.5 border-t border-outline-variant mt-2 ${
        collapsed ? "px-1" : "px-4"
      }`}>
        {collapsed ? (
          <>
            <a href="#" title="Pengaturan" className="flex justify-center items-center py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </a>
            <a href="#" title="Bantuan" className="flex justify-center items-center py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined text-[20px]">help</span>
            </a>
          </>
        ) : (
          <>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-colors font-label-md text-label-md">
              <span className="material-symbols-outlined text-[20px]">settings</span>
              Pengaturan
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-colors font-label-md text-label-md">
              <span className="material-symbols-outlined text-[20px]">help</span>
              Bantuan
            </a>
          </>
        )}
        {/* Toggle button */}
        <button
          onClick={toggle}
          title={collapsed ? "Perluas sidebar" : "Perkecil sidebar"}
          className={`w-full flex items-center py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-colors ${
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {collapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"}
          </span>
          {!collapsed && <span className="font-label-md text-label-md">Perkecil</span>}
        </button>
      </div>
    </aside>
  );
}
