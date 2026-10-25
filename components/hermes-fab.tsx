"use client";

import { useState } from "react";
import { Bot, KeyRound, X } from "lucide-react";

import { HermesChat } from "@/features/hermes/components/hermes-chat";

/**
 * Floating Hermes launcher: a round button pinned to the bottom-right of
 * every page that opens the chat in a popup panel, chat-widget style.
 */
export function HermesFab({ configured, visible = true }: { configured: boolean; visible?: boolean }) {
  const [open, setOpen] = useState(false);

  if (!visible) return null;

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Hermes chat"
          className="fixed bottom-[10.25rem] right-4 z-40 flex h-[30rem] max-h-[calc(100dvh-11.5rem)] w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl lg:bottom-[5.75rem] lg:right-6 lg:max-h-[calc(100dvh-6.75rem)]"
        >
          <header className="flex shrink-0 items-center gap-2.5 border-b px-4 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-4 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Hermes</p>
              <p className="text-xs text-muted-foreground">
                {configured ? "Workspace assistant" : "Setup required"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close Hermes chat"
              onClick={() => setOpen(false)}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col p-3">
            {configured ? (
              <HermesChat />
            ) : (
              <div className="flex flex-1 flex-col gap-3 rounded-2xl border bg-card p-4 text-sm">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <KeyRound className="size-4" aria-hidden="true" />
                </div>
                <p className="font-medium">Connect Hermes to Gemini</p>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                  <li>Create a key at aistudio.google.com/apikey</li>
                  <li>
                    Add <code className="rounded bg-muted px-1 py-0.5 text-xs">GEMINI_API_KEY=your-key</code> to .env.local
                  </li>
                  <li>Restart the app</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? "Close Hermes chat" : "Open Hermes chat"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none lg:bottom-6 lg:right-6"
      >
        {open ? (
          <X className="size-6" aria-hidden="true" />
        ) : (
          <Bot className="size-6" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
