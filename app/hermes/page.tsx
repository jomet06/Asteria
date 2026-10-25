import { connection } from "next/server";
import { KeyRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { hermesConfigured } from "@/features/hermes/config";
import { HermesChat } from "@/features/hermes/components/hermes-chat";
import { BotProfile } from "@/features/hermes/components/bot-profile";
import { BOT_DESCRIPTION, BOT_NAME } from "@/features/hermes/identity";

export const instant = false;

export default async function HermesPage() {
  await connection();
  const configured = hermesConfigured();

  return (
    <AppShell activePage="hermes" workspace>
      <div className="mx-auto flex h-[calc(100dvh-4rem)] min-h-0 w-full max-w-5xl flex-col p-3 sm:p-6">
        <section aria-label={`${BOT_NAME} workspace`} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card/30 sm:rounded-3xl">
          <header className="flex shrink-0 items-center gap-3 border-b bg-card/60 px-4 py-4 sm:px-6">
            <BotProfile configured={configured} />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">{BOT_NAME}</h1>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{BOT_DESCRIPTION}</p>
            </div>
          </header>
          {configured ? <HermesChat /> : <div className="m-auto max-w-md space-y-4 p-6"><KeyRound className="size-10 text-primary" /><h2 className="text-xl font-semibold">Let&apos;s connect your assistant</h2><p className="text-sm leading-6 text-muted-foreground">Ask your workspace administrator to connect the AI service, then reload this page to start chatting.</p></div>}
        </section>
      </div>
    </AppShell>
  );
}
