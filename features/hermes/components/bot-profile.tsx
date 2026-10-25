"use client";

import Image from "next/image";
import { Popover } from "radix-ui";
import { CalendarDays, CheckCheck, Clock3 } from "lucide-react";
import { BOT_AVATAR, BOT_DESCRIPTION, BOT_NAME } from "../identity";
import { cn } from "@/lib/utils";

export function BotAvatar({ className }: { className?: string }) {
  return <Image src={BOT_AVATAR} alt="" width={96} height={96}
    className={cn("size-10 shrink-0 rounded-2xl border border-primary/15 object-cover", className)} />;
}

export function BotProfile({ configured }: { configured: boolean }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`About ${BOT_NAME}`} title={`About ${BOT_NAME}`}
          className="shrink-0 rounded-2xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring">
          <BotAvatar />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content aria-label={`${BOT_NAME} profile`} side="bottom" align="start" sideOffset={12} collisionPadding={16}
          className="z-[80] w-72 max-w-[calc(100vw-2rem)] rounded-2xl border bg-popover p-5 text-popover-foreground shadow-xl outline-none">
          <BotAvatar className="mb-3 size-16 rounded-2xl" />
          <p className="font-semibold">{BOT_NAME}</p>
          <p className="mt-1 text-xs font-medium text-primary">Asteria workspace assistant</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{BOT_DESCRIPTION}</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li className="flex items-center gap-2"><CheckCheck className="size-4 text-primary" />Create and complete tasks</li>
            <li className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" />Create calendar events</li>
            <li className="flex items-center gap-2"><Clock3 className="size-4 text-primary" />Find free time in your day</li>
          </ul>
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{configured ? "Available here and in your linked Discord DMs." : "Connect the AI service to start chatting."}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
