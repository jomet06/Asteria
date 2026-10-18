import { AppShell } from "@/components/app-shell";

export default function TasksLoading() {
  return <AppShell activePage="tasks" workspace>
    <div role="status" aria-label="Loading your tasks" className="grid min-h-[70dvh] lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="hidden space-y-5 border-r bg-muted/20 px-7 py-10 lg:block">{[1, 2, 3, 4].map((item) => <div key={item} className="h-5 rounded bg-muted motion-safe:animate-pulse" />)}</div>
      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-12"><span className="sr-only">Loading your tasks…</span><div className="h-10 w-40 rounded bg-muted motion-safe:animate-pulse" /><div className="h-28 rounded-xl bg-muted/60 motion-safe:animate-pulse" />{[1, 2, 3].map((item) => <div key={item} className="h-12 rounded bg-muted/50 motion-safe:animate-pulse" />)}</div>
    </div>
  </AppShell>;
}
