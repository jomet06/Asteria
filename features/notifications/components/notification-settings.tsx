"use client";

import { useState, useTransition } from "react";
import { Bell, LoaderCircle } from "lucide-react";
import { saveNotificationPreferences } from "../actions";
import type { NotificationPreferences } from "../types";

const toggles = [
  ["inAppEnabled", "In-app notifications", "Keep reminders and updates in your notification center."],
  ["discordEnabled", "Discord reminders", "Send reminders to your linked Discord DM. Connect Discord below to receive them."],
  ["calendarEnabled", "Calendar events", "Reminders for local events, recurring occurrences and imported Google events."],
  ["deadlineEnabled", "Task deadlines", "A heads-up before an open task is due."],
  ["overdueEnabled", "Overdue tasks", "Remind you about tasks that still need your attention."],
  ["plannerEnabled", "Daily planner", "Plan availability, meaningful changes and a morning summary."],
] as const;

export function NotificationSettings({ initial, schemaPending, timezone }: { initial: NotificationPreferences; schemaPending: boolean; timezone: string }) {
  const [preferences, setPreferences] = useState(initial);
  const [busy, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <section id="notifications" aria-labelledby="notification-settings-title" className="scroll-mt-20 rounded-3xl border bg-card p-6 sm:p-8">
      <div className="mb-6 flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bell className="size-5" /></span><div><h2 id="notification-settings-title" className="text-xl font-semibold">Notifications</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Choose what reaches you and where. Reminder times follow {timezone}.</p></div></div>
      {schemaPending && <p role="status" className="mb-5 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">Notification storage is awaiting database setup. Preferences will become available once setup is complete.</p>}
      <form onSubmit={(event) => { event.preventDefault(); setFeedback(null); startTransition(async () => {
        try {
          const result = await saveNotificationPreferences(preferences);
          setFeedback({ ok: result.ok, message: result.ok ? "Notification preferences saved." : result.error });
          if (result.ok) window.dispatchEvent(new Event("asteria:notifications-changed"));
        } catch { setFeedback({ ok: false, message: "Could not save preferences. Please retry." }); }
      }); }}>
        <fieldset disabled={schemaPending || busy} className="space-y-6 disabled:opacity-60">
          <legend className="sr-only">Notification preferences</legend>
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">{toggles.map(([key, title, description]) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"><input type="checkbox" checked={preferences[key]} onChange={(event) => { setPreferences({ ...preferences, [key]: event.target.checked }); setFeedback(null); }} className="mt-1 size-4 shrink-0 accent-primary" /><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span></span></label>)}</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PreferenceSelect label="Before an event" value={preferences.eventLeadMinutes} options={[5, 10, 15, 30, 60].map((value) => [value, `${value} minutes`])} onChange={(eventLeadMinutes) => setPreferences({ ...preferences, eventLeadMinutes })} />
            <PreferenceSelect label="Before a deadline" value={preferences.deadlineLeadDays} options={[0, 1, 2, 3, 7].map((value) => [value, value ? `${value} day${value > 1 ? "s" : ""}` : "On the due date"])} onChange={(deadlineLeadDays) => setPreferences({ ...preferences, deadlineLeadDays })} />
            <PreferenceSelect label="Morning reminder time" value={preferences.morningHour} options={Array.from({ length: 12 }, (_, hour) => [hour, `${String(hour).padStart(2, "0")}:00`])} onChange={(morningHour) => setPreferences({ ...preferences, morningHour })} />
            <PreferenceSelect label="Repeat overdue reminders" value={preferences.overdueRepeatDays} options={[[1, "Once per day"], [0, "Once per deadline"]]} onChange={(overdueRepeatDays) => setPreferences({ ...preferences, overdueRepeatDays })} />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Date-only deadlines remain due through the end of that day. Their advance reminder uses your morning time. Turning off a category stops new reminders and cancels queued Discord deliveries; saved history stays available.</p>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed">{busy && <LoaderCircle className="size-4 animate-spin" />} {busy ? "Saving…" : "Save preferences"}</button>
        </fieldset>
        {feedback && <p role={feedback.ok ? "status" : "alert"} className={`mt-4 text-sm ${feedback.ok ? "text-primary" : "text-destructive"}`}>{feedback.message}</p>}
      </form>
    </section>
  );
}

function PreferenceSelect({ label, value, options, onChange }: { label: string; value: number; options: (readonly [number, string])[]; onChange: (value: number) => void }) {
  return <label className="block min-w-0 text-sm font-medium">{label}<select value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{options.map(([number, text]) => <option key={number} value={number}>{text}</option>)}</select></label>;
}
