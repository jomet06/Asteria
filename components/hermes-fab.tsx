"use client";

import { useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { KeyRound, Maximize2, Minimize2, X } from "lucide-react";
import { HermesChatPanel } from "@/features/hermes/components/hermes-chat";
import { BotAvatar, BotProfile } from "@/features/hermes/components/bot-profile";
import { BOT_NAME } from "@/features/hermes/identity";
import { useHermesConversation } from "@/features/hermes/use-hermes-conversation";
import { cn } from "@/lib/utils";

export function HermesFab({ configured, visible = true }: { configured: boolean; visible?: boolean }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  // Keep the conversation and in-flight request alive when the panel is minimized.
  const conversation = useHermesConversation();

  if (!visible) return null;

  return (
    <Dialog.Root modal={false} open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label={open ? `Minimize ${BOT_NAME}` : `Open ${BOT_NAME} chat`} title={BOT_NAME}
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-[#171a38] text-white shadow-xl outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none sm:right-6 sm:bottom-6">
          {open ? <X className="size-5" aria-hidden="true" /> : <BotAvatar className="size-12 rounded-xl border-0" />}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content ref={contentRef}
          onOpenAutoFocus={(event) => { event.preventDefault(); contentRef.current?.querySelector('textarea')?.focus({ preventScroll: true }); }}
          onInteractOutside={(event) => event.preventDefault()}
          className={cn("fixed top-20 right-3 bottom-24 z-[60] flex w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-3xl border bg-background text-foreground shadow-2xl outline-none sm:top-auto sm:right-6 sm:h-[min(42rem,calc(100dvh-11rem))] sm:w-[calc(100%-3rem)] motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in motion-safe:data-[state=open]:slide-in-from-bottom-2 motion-safe:data-[state=open]:duration-150", expanded ? "max-w-3xl" : "max-w-[440px]")}>
          <header className="flex shrink-0 items-center gap-3 border-b bg-card/60 px-4 py-3.5">
            <BotProfile configured={configured} />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold">{BOT_NAME}</Dialog.Title>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden="true" className={cn("size-1.5 rounded-full", configured ? "bg-primary" : "bg-muted-foreground")} />{configured ? "Workspace assistant" : "Setup required"}</p>
              <Dialog.Description className="sr-only">Chat about your tasks, calendar, and daily plan.</Dialog.Description>
            </div>
            <button type="button" aria-label={expanded ? "Compact chat" : "Expand chat"} title={expanded ? "Compact chat" : "Expand chat"}
              onClick={() => setExpanded((value) => !value)} className="hidden size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:flex">
              {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <Dialog.Close asChild>
              <button type="button" aria-label={`Close ${BOT_NAME} chat`} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><X className="size-5" aria-hidden="true" /></button>
            </Dialog.Close>
          </header>
          {configured ? <HermesChatPanel conversation={conversation} compact={!expanded} /> : <div className="flex flex-1 flex-col justify-center gap-3 p-6"><KeyRound className="size-8 text-primary" /><h2 className="text-lg font-semibold">Let&apos;s connect your assistant</h2><p className="text-sm leading-6 text-muted-foreground">An AI connection is needed to chat. Ask your workspace administrator to configure the service, then reload this page.</p></div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
