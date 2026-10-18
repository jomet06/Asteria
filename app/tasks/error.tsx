"use client";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function TasksError({ reset }: { reset: () => void }) {
  return <AppShell activePage="tasks" workspace>
    <div role="alert" className="mx-auto max-w-md px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Your tasks couldn’t load</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Check your connection and try again. Your saved tasks are safe.</p>
      <Button className="mt-6 min-h-11 px-5" onClick={reset}>Try again</Button>
    </div>
  </AppShell>;
}
