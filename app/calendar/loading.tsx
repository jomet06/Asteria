import { AppShell } from "@/components/app-shell";

export default function CalendarLoading() {
  return (
    <AppShell activePage="calendar" workspace>
      <CalendarSkeleton />
    </AppShell>
  );
}

function CalendarSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading calendar"
      className="min-h-[70dvh] space-y-7 px-4 py-8 sm:px-6"
    >
      <span className="sr-only">Loading calendar…</span>
      <div aria-hidden="true" className="space-y-7 motion-safe:animate-pulse">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 shrink-0 rounded-xl bg-muted" />
            <div className="space-y-3">
              <div className="h-8 w-36 rounded bg-muted" />
              <div className="h-4 w-48 max-w-full rounded bg-muted/60 sm:w-72" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-11 w-32 rounded-lg bg-muted/60 sm:w-44" />
            <div className="h-11 w-24 rounded-lg bg-muted" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="h-10 w-48 rounded-lg bg-muted" />
          <div className="h-10 w-40 rounded-lg bg-muted/60" />
        </div>
        <div className="flex flex-wrap gap-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-6 w-20 rounded-full bg-muted/50" />
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="grid grid-cols-7 border-b bg-muted/20">
            {Array.from({ length: 7 }, (_, day) => (
              <div key={day} className="flex justify-center px-1 py-4">
                <div className="h-3 w-6 rounded bg-muted sm:w-10" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }, (_, day) => (
              <div
                key={day}
                className="min-w-0 space-y-3 border-b border-r p-2 nth-[7n]:border-r-0 nth-last-[-n+7]:border-b-0 sm:min-h-24 sm:p-3"
              >
                <div className="h-4 w-4 rounded bg-muted" />
                <div className={`h-4 rounded bg-muted/50 ${day % 4 === 1 ? "" : "invisible"}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
