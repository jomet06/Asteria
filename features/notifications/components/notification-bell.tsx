"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { Bell, BellOff, CheckCheck, LoaderCircle, RefreshCw, Settings, X } from "lucide-react";
import { dismissNotification, markAllNotificationsRead, markNotificationRead } from "../actions";
import type { NotificationActionResult, NotificationInbox } from "../types";
import { NotificationItem } from "./notification-item";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<NotificationInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const requestRef = useRef<AbortController | null>(null);
  const browsingHistory = useRef(false);
  const load = useCallback(async (before?: string) => {
    if (document.visibilityState === "hidden") return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (before) setMoreLoading(true);
    browsingHistory.current = Boolean(before);
    try {
      const response = await fetch(`/api/notifications${before ? `?before=${encodeURIComponent(before)}` : ""}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in again to view notifications." : "Notifications could not load. Please retry.");
      const data: NotificationInbox = await response.json();
      if (controller.signal.aborted) return;
      setInbox((previous) => {
        if (!before || !previous) return data;
        return { ...data, items: [...previous.items, ...data.items.filter((item) => !previous.items.some((old) => old.id === item.id))] };
      });
      setError("");
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Notifications could not load.");
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setMoreLoading(false); }
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    const refresh = () => { if (active && !browsingHistory.current && document.visibilityState !== "hidden") void load(); };
    const poll = () => { timer = setTimeout(() => { refresh(); if (active) poll(); }, open ? 20_000 : 60_000); };
    refresh(); poll();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("asteria:notifications-changed", refresh);
    return () => { active = false; clearTimeout(timer); requestRef.current?.abort(); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("asteria:notifications-changed", refresh); };
  }, [load, open]);

  function mutate(action: () => Promise<NotificationActionResult>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) { setError(result.error); return; }
        await load();
      } catch { setError("Could not save this change. Please retry."); }
    });
  }

  const unread = inbox?.unread ?? 0;
  return (
    <Popover.Root open={open} onOpenChange={(value) => { browsingHistory.current = false; setOpen(value); }}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} title="Notifications" className="relative flex size-10 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Bell className="size-5" aria-hidden="true" />
          {unread > 0 && <span aria-hidden="true" className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content aria-label="Notification center" align="end" sideOffset={10} collisionPadding={12} className="z-[60] flex max-h-[min(38rem,calc(100dvh-6rem))] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
            <h2 className="flex-1 text-base font-semibold">Notifications <span className="ml-1 text-xs font-normal text-muted-foreground">{unread > 0 ? `${unread} unread` : ""}</span></h2>
            <Link href="/settings#notifications" onClick={() => setOpen(false)} aria-label="Notification settings" className="flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Settings className="size-4" aria-hidden="true" /></Link>
            <Popover.Close aria-label="Close notifications" className="flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden="true" /></Popover.Close>
          </div>
          {unread > 0 && <div className="border-b px-4 py-2"><button type="button" disabled={busy} onClick={() => mutate(markAllNotificationsRead)} className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><CheckCheck className="size-4" aria-hidden="true" />Mark all as read</button></div>}
          {error && <div role="alert" className="border-b bg-destructive/5 p-4 text-sm"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 font-medium text-primary hover:bg-primary/10"><RefreshCw className="size-3.5" />Retry</button></div>}
          <div aria-busy={loading || busy} className="min-h-0 overflow-y-auto overscroll-contain">
            {loading ? <div role="status" className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading notifications…</div>
              : inbox?.schemaPending ? <div role="status" className="p-6 text-center text-sm text-muted-foreground"><BellOff className="mx-auto mb-3 size-8 text-primary/60" /><p className="font-medium text-foreground">Notifications are being set up</p><p className="mt-2">Your workspace is available. Notification history will appear after database setup is complete.</p></div>
              : <>
                {inbox && !inbox.enabled && <p className="border-b bg-muted/40 px-4 py-3 text-xs text-muted-foreground">New in-app notifications are paused. Your saved history is still available.</p>}
                {inbox?.items.length ? <ul className="divide-y-0">{inbox.items.map((item) => <NotificationItem key={item.id} item={item} busy={busy} onRead={() => mutate(() => markNotificationRead(item.id))} onDismiss={() => mutate(() => dismissNotification(item.id))} onNavigate={() => { setOpen(false); if (!item.readAt) mutate(() => markNotificationRead(item.id)); }} />)}</ul> : !error && <div className="p-8 text-center text-sm text-muted-foreground"><Bell className="mx-auto mb-3 size-8 text-primary/60" /><p className="font-medium text-foreground">You’re all caught up</p><p className="mt-2 leading-relaxed">Event reminders, task deadlines and updates to your daily plan will appear here.</p></div>}
                {inbox?.hasMore && <div className="border-t p-3 text-center"><button type="button" disabled={moreLoading} onClick={() => void load(inbox.nextCursor ?? undefined)} className="min-h-10 rounded-lg px-4 text-sm text-primary hover:bg-primary/10 disabled:opacity-50">{moreLoading ? "Loading…" : "Load older notifications"}</button></div>}
              </>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
