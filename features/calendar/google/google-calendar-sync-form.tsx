"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { syncGoogleCalendars } from "./import-actions";

type Source = {
  id: string;
  googleCalendarId: string;
  name: string;
  isPrimary: boolean;
  selected: boolean;
  syncStatus: string;
  lastSuccessfulSync: Date | null;
};

export function GoogleCalendarSyncForm({ sources }: { sources: Source[] }) {
  const [selected, setSelected] = useState(
    () => new Set(sources.filter((source) => source.selected).map((source) => source.googleCalendarId)),
  );

  function toggle(calendarId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(calendarId)) next.delete(calendarId);
      else if (next.size < 3) next.add(calendarId);
      return next;
    });
  }

  return (
    <form action={syncGoogleCalendars} className="space-y-3 rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">Calendars to import</p>
        <span className="text-xs text-muted-foreground">{selected.size}/3 selected</span>
      </div>
      <div className="space-y-2">
        {sources.map((source) => {
          const checked = selected.has(source.googleCalendarId);
          const disabled = !checked && selected.size >= 3;
          return (
            <label key={source.id} className="flex min-h-10 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="calendarId"
                value={source.googleCalendarId}
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(source.googleCalendarId)}
              />
              <span className="min-w-0 flex-1 truncate">{source.name}</span>
              {source.isPrimary && <span className="text-xs text-muted-foreground">Primary</span>}
            </label>
          );
        })}
      </div>
      <Button type="submit" disabled={selected.size === 0}>Sync Now</Button>
      {sources.some((source) => source.lastSuccessfulSync) && (
        <p className="text-xs text-muted-foreground">
          Last sync: {sources.find((source) => source.lastSuccessfulSync)?.lastSuccessfulSync?.toLocaleString()}
        </p>
      )}
    </form>
  );
}

