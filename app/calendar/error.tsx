"use client";

export default function CalendarError({ reset }: { reset: () => void }) {
  return <section role="alert" className="space-y-4 p-8">
    <h1 className="text-xl font-semibold">Calendar could not be loaded</h1>
    <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
    <button type="button" onClick={reset} className="rounded-lg border px-4 py-2">Try again</button>
  </section>;
}
