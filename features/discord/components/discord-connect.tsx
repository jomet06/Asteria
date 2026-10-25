"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

import { createDiscordLinkCodeAction } from "../actions";

export function DiscordConnectForm() {
  const [pending, startTransition] = useTransition();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    if (pending) return;
    startTransition(async () => {
      const result = await createDiscordLinkCodeAction();
      if (result.ok) {
        setLinkCode(result.code);
        setError(null);
      } else {
        setError("Add DISCORD_BOT_TOKEN to .env.local first, then restart the app.");
        setLinkCode(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" onClick={generate} disabled={pending}>
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        Generate link code
      </Button>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {linkCode && (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
          <p>
            Your one-time code (valid for 10 minutes):{" "}
            <span className="rounded bg-background px-2 py-0.5 font-mono text-base font-semibold tracking-widest">
              {linkCode}
            </span>
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Open Discord and send the bot a direct message.</li>
            <li>
              Send exactly: <code className="rounded bg-background px-1 py-0.5 font-mono">link {linkCode}</code>
            </li>
            <li>The bot replies “Linked”, and this page updates shortly.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
