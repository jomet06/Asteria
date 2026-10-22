"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  PanelLeftOpen,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/utils";

type PageId = "dashboard" | "tasks" | "calendar" | "settings";

type AppSidebarProps = {
  children: ReactNode;
  activePage: PageId;
  workspace: boolean;
  displayName: string;
  email: string;
};

const navigation = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tasks", href: "/tasks", label: "To-Do List", icon: ListTodo },
  { id: "calendar", href: "/calendar", label: "Calendar", icon: CalendarDays },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
] as const;

// Keeps compatibility with the previous three-mode sidebar setting.
// "compact" is treated as open so the sidebar now has only two states.
const STORAGE_KEY = "asteria:sidebar-mode";
const SIDEBAR_CHANGED = "asteria:sidebar-changed";

function subscribeToSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_CHANGED, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SIDEBAR_CHANGED, callback);
  };
}

function getIsDesktopHidden(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "hidden";
  } catch {
    return false;
  }
}

function getServerDesktopHidden(): boolean {
  return false;
}

export function AppSidebar({
  children,
  activePage,
  workspace,
  displayName,
  email,
}: AppSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktopHidden = useSyncExternalStore(
    subscribeToSidebar,
    getIsDesktopHidden,
    getServerDesktopHidden
  );

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "U";

  function setDesktopHidden(hidden: boolean) {
    try {
      window.localStorage.setItem(STORAGE_KEY, hidden ? "hidden" : "expanded");
      window.dispatchEvent(new Event(SIDEBAR_CHANGED));
    } catch {
      // Without localStorage, the desktop sidebar stays expanded.
    }
  }

  // Exactly one closing button, with responsive behavior.
  function closeSidebar() {
    if (window.matchMedia("(min-width: 64rem)").matches) {
      setDesktopHidden(true);
    } else {
      setMobileOpen(false);
    }
  }

  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup sidebar"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        id="asteria-sidebar"
        aria-label="Sidebar aplikasi"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "transition-transform duration-300 motion-reduce:transition-none",
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full",
          desktopHidden
            ? "lg:invisible lg:-translate-x-full"
            : "lg:visible lg:translate-x-0"
        )}
      >
        {/* Header: only ONE closing button, on both mobile and desktop. */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-4 py-4">
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            aria-label="Asteria Dashboard"
            className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <span className="truncate text-lg font-semibold tracking-tight">
              Asteria
            </span>
          </Link>

          <button
            type="button"
            onClick={closeSidebar}
            aria-label="Tutup sidebar"
            aria-controls="asteria-sidebar"
            title="Tutup sidebar"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label="Navigasi utama"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-5"
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                  "transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Account stays at the lower-left edge of the sidebar. */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              title="Buka profil dan pengaturan"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground"
              >
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {displayName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </span>
            </Link>

            <form action={signOut} className="shrink-0">
              <button
                type="submit"
                aria-label="Logout"
                title="Logout"
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "flex min-h-dvh min-w-0 flex-col transition-[padding-left] duration-300 motion-reduce:transition-none",
          desktopHidden ? "lg:pl-0" : "lg:pl-72"
        )}
      >
        {/* Mobile opener: behind the drawer while open. */}
        <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            aria-label="Buka sidebar"
            aria-controls="asteria-sidebar"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="flex size-10 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            Asteria
          </Link>
        </div>

        {/* Desktop opener: visible only when the sidebar is hidden. */}
        {desktopHidden && (
          <div className="sticky top-0 z-30 hidden h-14 items-center border-b bg-background/95 px-5 backdrop-blur lg:flex">
            <button
              type="button"
              onClick={() => setDesktopHidden(false)}
              aria-controls="asteria-sidebar"
              aria-expanded={false}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PanelLeftOpen className="size-5" aria-hidden="true" />
              Tampilkan sidebar
            </button>
          </div>
        )}

        <main
          className={cn(
            "mx-auto w-full min-w-0 flex-1",
            workspace ? "max-w-[1440px]" : "max-w-6xl px-4 py-10 sm:px-6"
          )}
        >
          {children}
        </main>

        {!workspace && (
          <footer className="border-t py-6 text-center text-xs text-muted-foreground">
            Asteria — Your Personal Operating System
          </footer>
        )}
      </div>
    </div>
  );
}
