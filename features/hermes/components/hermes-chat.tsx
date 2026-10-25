"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Bot,
  LoaderCircle,
  SendHorizontal,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { sendHermesMessage, type HermesToolNote } from "../actions";

type ChatMessage = {
  role: "user" | "model";
  text: string;
  tools?: HermesToolNote[];
};

const GREETING =
  "Hi! I'm Hermes, your workspace assistant. Ask me to create events or tasks, find free time in your day, or check what's coming up.";

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Hermes is not configured yet. Add GEMINI_API_KEY to .env.local and restart the app.",
  invalid_message: "Write a short message first (up to 2000 characters).",
  rate_limited: "Gemini is rate-limiting requests right now. Try again in a moment.",
  model_unavailable: "The configured Gemini model is not available for your key. Set GEMINI_MODEL in .env.local to a supported model, then restart.",
  hermes_unavailable: "Hermes could not reach the AI service. Try again shortly.",
};

export function HermesChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "model", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;

    // The greeting is presentation, not conversation history.
    const history = messages.slice(1).map(({ role, text: messageText }) => ({ role, text: messageText }));

    setMessages((current) => [...current, { role: "user", text }]);
    setInput("");
    setPending(true);
    setError(null);

    const data = new FormData();
    data.set("message", text);
    data.set("history", JSON.stringify(history));

    try {
      const result = await sendHermesMessage(data);
      if (result.ok) {
        setMessages((current) => [
          ...current,
          {
            role: "model",
            text: result.reply,
            tools: result.tools.length ? result.tools : undefined,
          },
        ]);
      } else {
        setError(ERROR_MESSAGES[result.error] ?? "Something went wrong.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border bg-card">
      <div
        aria-live="polite"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-2.5 ${message.role === "user" ? "justify-end" : ""}`}
          >
            {message.role === "model" && (
              <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="size-4 text-primary" aria-hidden="true" />
              </div>
            )}
            <div className={`max-w-[85%] space-y-2 ${message.role === "user" ? "text-right" : ""}`}>
              <p
                className={`inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/70 text-foreground"
                }`}
              >
                {message.text}
              </p>
              {message.tools?.length ? (
                <ul className="space-y-1">
                  {message.tools.map((tool, toolIndex) => (
                    <li
                      key={toolIndex}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      <Wrench className="size-3 shrink-0" aria-hidden="true" />
                      <span className="font-medium">{tool.name}</span>
                      <span className="truncate">{tool.summary}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}

        {pending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Hermes is thinking…
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="border-t px-4 pt-3 text-sm text-destructive sm:px-5">
          {error}
        </p>
      )}

      <form
        aria-label="Message Hermes"
        aria-busy={pending}
        className="flex items-end gap-2 border-t p-3 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="hermes-input" className="sr-only">
          Message Hermes
        </label>
        <textarea
          id="hermes-input"
          rows={1}
          maxLength={2000}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Ask Hermes to plan your day, add an event, or create a task…"
          className="max-h-40 min-h-11 flex-1 resize-y rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={pending}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          className="size-11 shrink-0 rounded-full"
          disabled={pending || !input.trim()}
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <SendHorizontal className="size-4" aria-hidden="true" />
          )}
        </Button>
      </form>

      <p className="px-4 pb-3 text-xs text-muted-foreground sm:px-5">
        Hermes acts through validated workspace tools only — every change it makes follows the same rules as the app.
      </p>
    </div>
  );
}
