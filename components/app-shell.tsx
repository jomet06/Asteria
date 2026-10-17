
import Link from "next/link";
import type { ReactNode } from "react";

import {
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";

import { signOut } from "@/app/auth/actions";
import {
  Button,
  buttonVariants,
} from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  activePage:
    | "dashboard"
    | "projects"
    | "tasks"
    | "settings";
};

const navigation = [
  {
    id: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "projects",
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
  },
  {
    id: "tasks",
    href: "/tasks",
    label: "Tasks",
    icon: ListTodo,
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
] as const;

export function AppShell({
  children,
  activePage,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b bg-card/50">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xl font-bold tracking-tight"
          >
            <Sparkles className="size-5 text-primary" />
            Asteria
          </Link>

          <nav
            aria-label="Main navigation"
            className="order-3 flex w-full flex-wrap items-center gap-1 sm:order-none sm:w-auto"
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive =
                activePage === item.id;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={
                    isActive ? "page" : undefined
                  }
                  className={cn(
                    buttonVariants({
                      variant: isActive
                        ? "secondary"
                        : "ghost",
                    }),
                    "gap-2"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form action={signOut}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
            >
              <LogOut className="size-4" />
              Logout
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Asteria — Your Personal Operating System
      </footer>
    </div>
  );
}
