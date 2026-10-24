import { connection } from "next/server";
import { Bot, KeyRound } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMyAccount } from "@/features/profile/data";
import {
  DEFAULT_GEMINI_MODEL,
  hermesConfigured,
} from "@/features/hermes/config";
import { HermesChat } from "@/features/hermes/components/hermes-chat";

export const instant = false;

export default async function HermesPage() {
  await connection();
  await getMyAccount();
  const configured = hermesConfigured();

  return (
    <AppShell activePage="hermes">
      <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="size-6 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hermes</h1>
            <p className="text-sm text-muted-foreground">
              Your AI agent for events, tasks, and daily planning.
            </p>
          </div>
        </header>

        {configured ? (
          <HermesChat />
        ) : (
          <Card className="max-w-xl">
            <CardHeader>
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-muted">
                <KeyRound className="size-5" aria-hidden="true" />
              </div>
              <CardTitle>Connect Hermes to Gemini</CardTitle>
              <CardDescription>
                Hermes needs a Google Gemini API key to answer and act on your
                workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  Create a key at{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    aistudio.google.com/apikey
                  </a>
                  .
                </li>
                <li>
                  Add <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GEMINI_API_KEY=your-key</code>{" "}
                  to <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env.local</code>.
                </li>
                <li>
                  Optionally set <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GEMINI_MODEL</code>{" "}
                  (default: {DEFAULT_GEMINI_MODEL}).
                </li>
                <li>Restart the app, then reload this page.</li>
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
