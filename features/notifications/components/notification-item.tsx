"use client";

import Link from "next/link";
import { CalendarDays, Check, ListTodo, Sunrise, X } from "lucide-react";
import type { NotificationItem as Item } from "../types";

export function NotificationItem({ item, busy, onRead, onDismiss, onNavigate }: {
  item: Item; busy: boolean;
  onRead: () => void; onDismiss: () => void; onNavigate: () => void;
}) {
  const Icon = item.kind === "event_starting" ? CalendarDays : ["daily_plan", "plan_ready"].includes(item.kind) ? Sunrise : ListTodo;
  return (
    <li className={`flex gap-3 border-b p-4 last:border-b-0 ${item.readAt ? "bg-card" : "bg-primary/5"}`}>
      <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <Link href={item.href} onClick={onNavigate} className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex items-start gap-2">
            <p className="min-w-0 break-words text-sm font-semibold">{item.title}</p>
            {!item.readAt && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"><span className="sr-only">Unread</span></span>}
          </div>
          <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{item.message}</p>
          <time dateTime={item.createdAt} className="mt-2 block text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time>
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {!item.readAt && <button type="button" disabled={busy} onClick={onRead} aria-label={`Mark ${item.title} as read`} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><Check className="size-3.5" aria-hidden="true" />Mark read</button>}
          <button type="button" disabled={busy} onClick={onDismiss} aria-label={`Dismiss ${item.title}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><X className="size-3.5" aria-hidden="true" />Dismiss</button>
        </div>
      </div>
    </li>
  );
}
