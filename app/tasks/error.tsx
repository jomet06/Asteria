
"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function TasksError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm"
      >
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-7" />
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Your tasks couldn't load
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Something went wrong while loading your tasks.
          Please try again.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            onClick={() => reset()}
            className="min-h-10 gap-2"
          >
            <RefreshCw className="size-4" />
            Try again
          </Button>

          <Button variant="outline" asChild>
            <Link href="/dashboard" className="gap-2">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
