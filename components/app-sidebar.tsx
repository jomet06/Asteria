"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Settings,
} from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";
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

function getIsDesktopHidden() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "hidden";
  } catch {
    return false;
  }
}

function subscribeToDesktop(callback: () => void) {
  const media = window.matchMedia("(min-width: 64rem)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getIsDesktop() {
  return window.matchMedia("(min-width: 64rem)").matches;
}

export function AppSidebar({
  children,
  activePage,
  workspace,
  displayName,
  email,
}: AppSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopHoverOpen, setDesktopHoverOpen] = useState(false);
  const desktopHidden = useSyncExternalStore(
    subscribeToSidebar,
    getIsDesktopHidden,
    () => false,
  );
  const isDesktop = useSyncExternalStore(subscribeToDesktop, getIsDesktop, () => false);
  const desktopExpanded = !desktopHidden || desktopHoverOpen;
  const navigationExpanded = isDesktop ? desktopExpanded : mobileOpen;

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
      // Keep the expanded state when storage is unavailable.
    }
  }

  function toggleNavigation() {
    if (window.matchMedia("(min-width: 64rem)").matches) {
      setDesktopHidden(!desktopHidden);
      setDesktopHoverOpen(false);
    } else {
      setMobileOpen((open) => !open);
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
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border bg-background/95 px-4 backdrop-blur">
        <div className="flex h-full items-center gap-3">
          <button
            type="button"
            onClick={toggleNavigation}
            aria-controls="asteria-sidebar"
            aria-expanded={navigationExpanded}
            aria-label={navigationExpanded ? "Tutup sidebar" : "Buka sidebar"}
            title={navigationExpanded ? "Tutup sidebar" : "Buka sidebar"}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>

          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            aria-label="Asteria Dashboard"
            className="flex min-w-0 items-center gap-2 rounded-lg font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image src="/brand/asteria-icon.svg" alt="" width={30} height={30} className="size-7 shrink-0 rounded-lg" />
            <span className="truncate text-base sm:text-lg">Asteria</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Notifications"
              title="Notifications"
              className="flex size-10 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bell className="size-5" aria-hidden="true" />
            </button>

            <ThemeToggle className="size-10 text-foreground hover:bg-muted" />

            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              aria-label="Buka profil dan pengaturan"
              title={`${displayName} · ${email}`}
              className="flex size-10 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              >
                {initials}
              </span>
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                aria-label="Logout"
                title="Logout"
                className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <aside
        id="asteria-sidebar"
        aria-label="Sidebar aplikasi"
        onMouseEnter={() => {
          if (desktopHidden) setDesktopHoverOpen(true);
        }}
        onMouseLeave={() => setDesktopHoverOpen(false)}
        className={cn(
          "fixed bottom-0 left-0 top-16 z-40 flex h-[calc(100dvh-4rem)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl",
          "w-72 -translate-x-full transition-[width,transform] duration-200 motion-reduce:transition-none",
          "lg:translate-x-0",
          desktopExpanded ? "lg:w-72" : "lg:w-[4.5rem]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <nav
          aria-label="Navigasi utama"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-4"
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
                title={!desktopExpanded ? item.label : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl text-sm font-medium transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  "justify-start px-[18px]",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className={cn("truncate", desktopExpanded ? "lg:block" : "lg:hidden")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

      </aside>

      <div
        className={cn(
          "flex min-h-dvh min-w-0 flex-col pt-16 transition-[padding-left] duration-200 motion-reduce:transition-none",
          desktopHidden ? "lg:pl-[4.5rem]" : "lg:pl-72",
        )}
      >
        <main
          className={cn(
            "mx-auto w-full min-w-0 flex-1",
            workspace ? "max-w-[1440px]" : "max-w-6xl px-4 py-10 sm:px-6",
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
