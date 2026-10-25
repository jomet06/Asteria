"use client";

import { isCalendarDay } from "../date-time";

const controlClass = "min-h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function EventDateField({ id, label, name, value, onChange, required = true, min }: {
  id: string;
  label: string;
  name?: string;
  value: string;
  onChange: (day: string) => void;
  required?: boolean;
  min?: string;
}) {
  const readableDay = isCalendarDay(value)
    ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`))
    : "Choose a date";
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{label}</label>
    <input id={id} name={name} type="date" required={required} value={value} min={min || "1900-01-01"} max="2100-12-31"
      onInput={(event) => onChange(event.currentTarget.value)} aria-describedby={`${id}-day`} className={controlClass} />
    <p id={`${id}-day`} className="min-h-5 text-xs leading-5 text-muted-foreground">{readableDay}</p>
  </div>;
}

export function EventTimeField({ id, label, value, onChange }: {
  id: string;
  label: string;
  value: string;
  onChange: (time: string) => void;
}) {
  const [hour = "09", minute = "00"] = value.split(":");
  return <fieldset className="min-w-0">
    <legend className="mb-1.5 flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground">{label}<span className="font-normal">24-hour</span></legend>
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={`${id}-hour`} className="sr-only">{label} hour</label>
      <select id={`${id}-hour`} value={hour} onChange={(event) => onChange(`${event.target.value}:${minute}`)} className={controlClass}>
        {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <span aria-hidden="true" className="font-medium text-muted-foreground">:</span>
      <label htmlFor={`${id}-minute`} className="sr-only">{label} minute</label>
      <select id={`${id}-minute`} value={minute} onChange={(event) => onChange(`${hour}:${event.target.value}`)} className={controlClass}>
        {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  </fieldset>;
}
