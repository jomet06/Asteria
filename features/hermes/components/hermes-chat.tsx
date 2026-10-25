"use client";

import { useEffect, useId, useRef } from "react";
import { ArrowUp, CalendarDays, CheckCheck, Clock3, LoaderCircle, MessageSquarePlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOT_NAME } from "../identity";
import { CHAT_ERRORS, MAX_MESSAGE_LENGTH, TOOL_LABELS } from "../conversation";
import { useHermesConversation, type HermesConversation } from "../use-hermes-conversation";
import { BotAvatar } from "./bot-profile";
import { MessageContent } from "./message-content";

const STARTERS = [
  { icon: CalendarDays, title: "What's on today?", detail: "See your schedule and priorities", prompt: "Ringkas jadwal dan tugas prioritas saya hari ini." },
  { icon: Clock3, title: "Find focus time", detail: "Make room for your next task", prompt: "Cari waktu luang 60 menit hari ini untuk fokus mengerjakan tugas." },
  { icon: CheckCheck, title: "Create a task", detail: "Turn an idea into a next step", prompt: "Bantu buatkan tugas baru: " },
] as const;

export function HermesChat() {
  const conversation = useHermesConversation();
  return <HermesChatPanel conversation={conversation} />;
}

export function HermesChatPanel({ conversation, compact = false }: { conversation: HermesConversation; compact?: boolean }) {
  const { turns, input, setInput, pending, send, newChat } = conversation;
  const inputId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const followRef = useRef(true);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (!turns.length) scroll.scrollTop = 0;
    else if (followRef.current) scroll.scrollTop = scroll.scrollHeight;
  }, [turns, pending, compact]);

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 160)}px`;
  }, [input]);

  function submit() {
    followRef.current = true;
    void send();
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={scrollRef} role="log" aria-label={`${BOT_NAME} conversation`} aria-live="polite" aria-relevant="additions text"
        onScroll={(event) => { const area = event.currentTarget; followRef.current = area.scrollHeight - area.scrollTop - area.clientHeight < 80; }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        {!turns.length ? (
          <div className={`mx-auto grid min-h-full content-center ${compact ? "max-w-lg gap-5" : "max-w-3xl gap-6 py-3 md:grid-cols-2 md:items-center md:gap-8"}`}>
            <div>
              {!compact && <BotAvatar className="mb-4 size-12 rounded-2xl" />}
              {!compact && <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">A little clarity for your day</p>}
              <h2 className={`font-semibold tracking-tight ${compact ? "text-2xl" : "text-3xl"}`}>What can we get done?</h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">I&apos;m {BOT_NAME}. Let&apos;s organize your tasks, plan around your calendar, and find time to focus.</p>
            </div>
            <div className="grid gap-2">
              {STARTERS.map(({ icon: Icon, title, detail, prompt }) => (
                <button key={title} type="button" onClick={() => { setInput(prompt); inputRef.current?.focus({ preventScroll: true }); }}
                  className={`group flex min-w-0 items-center gap-3 rounded-xl border bg-background/50 px-3.5 text-left outline-none transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring ${compact ? "min-h-11 py-2" : "min-h-14 py-3"}`}>
                  <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span>{!compact && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}</span>
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-hover:translate-x-0.5">↗</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {turns.map((turn) => (
              <div key={turn.id} className="space-y-5">
                <div className="flex justify-end pl-8">
                  <div className="max-w-[90%] min-w-0 whitespace-pre-wrap wrap-anywhere rounded-2xl rounded-br-md bg-primary/15 px-4 py-3 text-sm leading-6">{turn.message}</div>
                </div>
                {turn.reply !== undefined && (
                  <div className="flex min-w-0 items-start gap-3">
                    <BotAvatar className="mt-1 size-7 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-3">
                      <span className="text-xs font-medium text-muted-foreground">{BOT_NAME}</span>
                      <MessageContent text={turn.reply} />
                      {!!turn.tools?.length && <details className="rounded-xl border bg-muted/20 text-xs text-muted-foreground">
                        <summary className="cursor-pointer px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">Workspace activity · {turn.tools.length}</summary>
                        <ul className="space-y-3 border-t px-3 py-3">{turn.tools.map((tool, index) => <li key={index} className="wrap-anywhere"><span className="font-medium text-foreground">{TOOL_LABELS[tool.name] ?? "Workspace action"}</span><p className="mt-1 leading-5">{tool.summary}</p></li>)}</ul>
                      </details>}
                    </div>
                  </div>
                )}
                {turn.error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-6 text-destructive">{CHAT_ERRORS[turn.error] ?? CHAT_ERRORS.hermes_unavailable}</div>}
              </div>
            ))}
            {pending && <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground"><BotAvatar className="size-7 rounded-lg" /><LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />{BOT_NAME} is thinking…</div>}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-background/80 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
        <form aria-label={`Message ${BOT_NAME}`} aria-busy={pending} onSubmit={(event) => { event.preventDefault(); submit(); }}
          className="mx-auto max-w-2xl rounded-2xl border bg-card p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
          <label htmlFor={inputId} className="sr-only">Message {BOT_NAME}</label>
          <textarea ref={inputRef} id={inputId} rows={1} maxLength={MAX_MESSAGE_LENGTH} value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
            }}
            placeholder="Ask, plan, or create something…"
            aria-describedby={`${inputId}-hint`}
            className="block max-h-40 min-h-12 w-full resize-none bg-transparent px-2.5 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground" />
          <div className="flex items-center justify-between gap-2 pl-2.5">
            {turns.length ? <button type="button" disabled={pending} onClick={() => { newChat(); inputRef.current?.focus({ preventScroll: true }); }}
              className="flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
              <MessageSquarePlus className="size-3.5" aria-hidden="true" />New chat
            </button> : <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles className="size-3 shrink-0" aria-hidden="true" />Tasks & calendar</span>}
            <div className="flex items-center gap-2">
              {input.length > 1700 && <span className="text-[11px] tabular-nums text-muted-foreground">{input.length}/{MAX_MESSAGE_LENGTH}</span>}
              <Button type="submit" size="icon" aria-label="Send message" className="size-10 shrink-0 rounded-xl" disabled={pending || !input.trim()}>
                {pending ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : <ArrowUp className="size-5" aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </form>
        <p id={`${inputId}-hint`} className="mt-2 text-center text-[10px] leading-4 text-muted-foreground">Enter to send · Shift + Enter for a new line</p>
      </div>
    </div>
  );
}
