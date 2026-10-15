
import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight"
          >
            <Sparkles className="size-6 text-primary" />
            Asteria
          </Link>

          <p className="mt-3 text-sm text-muted-foreground">
            Your intelligent personal workspace.
          </p>
        </div>

        <Card className="shadow-lg shadow-foreground/5">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">
              {title}
            </CardTitle>

            <CardDescription>
              {description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {children}
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Asteria — AI-powered Personal OS
        </p>
      </div>
    </main>
  );
}
