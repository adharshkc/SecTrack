"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { apiFetch, cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/roadmap", label: "Learning Roadmap", icon: BookOpen },
  { href: "/daily", label: "Daily Tracker", icon: Clock },
  { href: "/weekly", label: "Weekly Report", icon: BarChart3 },
  { href: "/monthly", label: "Monthly Report", icon: CalendarDays },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  csrfToken,
  initialTheme = "dark",
  timezone = "Asia/Kolkata",
  storageProvider = "postgres",
}: {
  children: React.ReactNode;
  csrfToken: string;
  initialTheme?: "dark" | "light";
  timezone?: string;
  storageProvider?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(initialTheme);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      await apiFetch("/api/settings", {
        method: "PATCH",
        csrfToken,
        body: JSON.stringify({ theme: next }),
      });
    } catch {
      // non-fatal preference save
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              SecTrack<span className="text-emerald-500">.io</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Cybersecurity Mastery
            </p>
          </div>
        </div>

        <nav aria-label="Main navigation" className="mt-4 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-500/25"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 p-3 space-y-2 dark:border-slate-800/80">
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-900/90 dark:text-slate-400">
          <div className="flex items-center justify-between">
            <span>Timezone</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
              {timezone}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Storage</span>
            <span className="font-mono uppercase text-emerald-600 dark:text-emerald-400">
              {storageProvider}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-slate-600" />
                <span>Dark</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{signingOut ? "..." : "Sign Out"}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#070b14] dark:text-slate-100">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-[#0e1525]/90">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold">
            SecTrack<span className="text-emerald-500">.io</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-64 bg-white dark:bg-[#0e1525] border-r border-slate-200 dark:border-slate-800">
            {navContent}
          </aside>
        </div>
      ) : null}

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white lg:block dark:border-slate-800/80 dark:bg-[#0b111e]">
        {navContent}
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
