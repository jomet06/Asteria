"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  ListTodo,
  MessageCircle,
  Sparkles,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* Hand-built miniature app screens: no screenshots, just real markup. */

function CalendarScreen() {
  const days = Array.from({ length: 35 }, (_, index) => index + 1);
  const marked: Record<number, { kind: string; label: string }[]> = {
    14: [{ kind: "bg-sky-500", label: "Class" }],
    16: [{ kind: "bg-primary", label: "Meeting" }, { kind: "bg-violet-500", label: "Block" }],
    21: [{ kind: "bg-amber-500", label: "Deadline" }],
    23: [{ kind: "bg-emerald-500", label: "Plan" }],
    28: [{ kind: "bg-primary", label: "UTS" }],
  };
  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">October 2026</p>
        <div className="flex rounded-lg border p-0.5 text-[11px] font-medium">
          <span className="rounded-md bg-secondary px-2.5 py-1">Month</span>
          <span className="px-2.5 py-1 text-muted-foreground">Week</span>
          <span className="px-2.5 py-1 text-muted-foreground">Day</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          <span key={index} className="pb-1 text-center text-[10px] font-semibold text-muted-foreground">{day}</span>
        ))}
        {days.map((day) => {
          const marks = marked[Math.max(1, ((day - 1) % 30) + 1)];
          return (
            <div
              key={day}
              className={cn(
                "flex min-h-10 flex-col gap-1 rounded-lg border p-1.5",
                day === 16 ? "border-primary bg-primary/5" : "border-transparent bg-muted/40",
              )}
            >
              <span className={cn("text-[10px] font-semibold tabular-nums", day === 16 ? "text-primary" : "text-muted-foreground")}>
                {((day - 1) % 30) + 1}
              </span>
              <div className="flex gap-0.5">
                {marks?.map((mark, index) => (
                  <span key={index} className={cn("size-1.5 rounded-full", mark.kind)} aria-label={mark.label} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border bg-card p-3.5 shadow-sm">
        <p className="text-sm font-semibold">Design sync</p>
        <p className="mt-1 text-xs text-muted-foreground">Friday, 16 October ⋅ 7:30 – 10:30am · Weekly on Friday</p>
        <div className="mt-2.5 flex gap-1.5">
          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-300">Google Calendar</span>
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-300">2-way sync</span>
        </div>
      </div>
    </div>
  );
}

function TasksScreen() {
  const tasks = [
    { title: "UTS Basis Data review", priority: "URGENT", done: false, progress: 60 },
    { title: "Essay draft", priority: "HIGH", done: false, progress: 25 },
    { title: "Read chapter 4", priority: "MEDIUM", done: true, progress: 100 },
  ];
  return (
    <div className="space-y-3.5 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">To-Do List</p>
        <span className="rounded-full border px-2.5 py-1 text-[10px] font-medium text-muted-foreground">2 tasks to do</span>
      </div>
      {tasks.map((task) => (
        <div key={task.title} className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm">
          <span
            className={cn(
              "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border",
              task.done ? "border-primary bg-primary text-primary-foreground" : "border-input",
            )}
          >
            {task.done && <CheckCheck className="size-3" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-xs font-medium", task.done && "text-muted-foreground line-through")}>{task.title}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${task.progress}%` }} />
              </div>
              <span className="text-[9px] tabular-nums text-muted-foreground">{task.progress}%</span>
            </div>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-semibold",
              task.priority === "URGENT" ? "bg-destructive/10 text-destructive" : task.priority === "HIGH" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {task.priority}
          </span>
        </div>
      ))}
      <div className="rounded-xl border border-dashed bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Daily Plan · arranged by Asteria bot
        </div>
        <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
          <p>1. Essay draft · 09:00–10:30</p>
          <p>2. UTS Basis Data review · 13:00–15:00</p>
        </div>
      </div>
    </div>
  );
}

function HermesScreen() {
  return (
    <div className="space-y-3 p-5 sm:p-6">
      <div className="flex items-center gap-2 border-b pb-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="size-4 text-primary" aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold">Asteria bot</p>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> Gemini
        </span>
      </div>
      <div className="ml-8 max-w-[85%] rounded-2xl bg-muted/70 px-3.5 py-2.5 text-xs leading-relaxed">
        Hi! Ask me to plan your day, create events, or find free time.
      </div>
      <div className="ml-auto max-w-[85%] rounded-2xl bg-primary px-3.5 py-2.5 text-xs leading-relaxed text-primary-foreground">
        Besok ada meeting 2 jam jam 2 siang, sisanya tolong atur belajar UTS
      </div>
      <div className="max-w-[92%] space-y-1.5">
        <div className="ml-8 rounded-2xl bg-muted/70 px-3.5 py-2.5 text-xs leading-relaxed">
          Siap! Meeting dibuatkan 14:00–16:00, dan saya susun rencana belajar di sekitarnya.
        </div>
        <div className="ml-8 inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[10px] text-muted-foreground">
          <Wrench className="size-3" aria-hidden="true" />
          <span className="font-medium">create_event</span>
          <CircleCheck className="size-3 text-emerald-500" aria-hidden="true" />
          Meeting 14:00–16:00
        </div>
        <div className="ml-8 inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[10px] text-muted-foreground">
          <Wrench className="size-3" aria-hidden="true" />
          <span className="font-medium">find_free_slots</span>
          <CircleCheck className="size-3 text-emerald-500" aria-hidden="true" />
          3 windows found
        </div>
      </div>
    </div>
  );
}

function DiscordScreen() {
  return (
    <div className="space-y-3 p-5 sm:p-6">
      <div className="flex items-center gap-2 border-b pb-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">A</span>
        <div>
          <p className="text-sm font-semibold">Asteria Bot</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">online</p>
        </div>
        <MessageCircle className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="rounded-xl rounded-tl-sm bg-muted/70 px-3.5 py-2.5 text-xs leading-relaxed">
        ⏰ “Design sync” starts at 14:00.
      </div>
      <div className="rounded-xl rounded-tl-sm bg-muted/70 px-3.5 py-2.5 text-xs leading-relaxed">
        📌 Deadline: “Essay draft” is due tomorrow 23:59.
      </div>
      <div className="rounded-xl rounded-tl-sm bg-muted/70 px-3.5 py-2.5 text-xs leading-relaxed">
        🗓️ Plan for today (3 tasks): Essay → UTS review → Read ch. 4
      </div>
      <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-xs leading-relaxed text-primary-foreground">
        tandai essay draft udah selesai
      </div>
      <div className="rounded-xl rounded-tl-sm bg-muted/70 px-3.5 py-2.5 text-xs leading-relaxed">
        ✅ “Essay draft” marked as done. Nice progress!
      </div>
    </div>
  );
}

const tabs = [
  { id: "calendar", label: "Calendar", icon: CalendarDays, blurb: "Month, week and day views with recurring events, conflict checks, and two-way Google Calendar sync.", screen: <CalendarScreen /> },
  { id: "tasks", label: "Tasks & Planner", icon: ListTodo, blurb: "Projects, subtasks, priorities, difficulty, estimates, and dependencies, planned daily by AI.", screen: <TasksScreen /> },
  { id: "hermes", label: "Asteria bot", icon: Bot, blurb: "A Gemini-powered agent that reads your workspace and acts through validated tools.", screen: <HermesScreen /> },
  { id: "discord", label: "Discord", icon: MessageCircle, blurb: "Natural-language commands and proactive reminders delivered to your DMs.", screen: <DiscordScreen /> },
];

const AUTO_ADVANCE_MS = 7000;

/** Interactive product tour: tabbed mock screens with auto-advance. */
export function ProductTour() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setActive((value) => (value + 1) % tabs.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [paused]);

  const current = tabs[active];

  return (
    <div
      className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
    >
      <div role="tablist" aria-label="Product tour" className="order-2 space-y-2.5 lg:order-1">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const selected = index === active;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={cn(
                "flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left outline-none transition-all",
                "focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border hover:border-primary/25 hover:bg-muted/40",
              )}
            >
              <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", selected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("flex items-center gap-1.5 text-sm font-semibold", selected ? "text-foreground" : "text-foreground/80")}>
                  {tab.label}
                  <ChevronRight className={cn("size-3.5 transition-transform", selected ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0")} aria-hidden="true" />
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{tab.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="order-1 lg:order-2">
        <div className="rounded-3xl border bg-card p-2 shadow-2xl shadow-primary/5">
          <div className="flex items-center gap-1.5 px-3 py-2">
            <span className="size-2.5 rounded-full bg-red-400/80" aria-hidden="true" />
            <span className="size-2.5 rounded-full bg-amber-400/80" aria-hidden="true" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" aria-hidden="true" />
            <span className="ml-3 truncate rounded-md bg-muted px-2.5 py-0.5 text-[10px] text-muted-foreground">
              asteria.app/{current.id}
            </span>
          </div>
          <div role="tabpanel" className="min-h-[26rem] overflow-hidden rounded-2xl border bg-background sm:min-h-[28rem]">
            {current.screen}
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              className={cn("h-1.5 rounded-full transition-all", index === active ? "w-7 bg-primary" : "w-3 bg-muted-foreground/30 hover:bg-muted-foreground/50")}
              onClick={() => setActive(index)}
              aria-label={`Show ${tab.label}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
