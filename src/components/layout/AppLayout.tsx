"use client";

import TopBar from "./TopBar";

interface AppLayoutProps {
  children: React.ReactNode;
  searchPlaceholder?: string;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="pt-16 min-h-screen">
        <div className="p-10 max-w-[1440px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
