import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { getMyAccount } from "@/features/profile/data";

type AppShellProps = {
  children: ReactNode;
  workspace?: boolean;
  activePage: "dashboard" | "tasks" | "calendar" | "settings";
};

export async function AppShell({
  children,
  activePage,
  workspace = false,
}: AppShellProps) {
  const { user, profile } = await getMyAccount();

  const displayName =
    profile.displayName?.trim() ||
    user.email?.split("@")[0] ||
    "User";

  return (
    <AppSidebar
      activePage={activePage}
      workspace={workspace}
      displayName={displayName}
      email={user.email ?? ""}
    >
      {children}
    </AppSidebar>
  );
}
