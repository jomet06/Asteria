
import Link from "next/link";

import {
  CalendarDays,
  ListTodo,
  Bot,
  MessageCircle,
  BookOpen,
  Dumbbell,
  Wallet,
  ArrowRight,
} from "lucide-react";

import { ModuleCard } from "@/components/module-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

const modules = [
  {
    id: "calendar",
    title: "Calendar & Scheduling",
    description:
      "Manage schedules, recurring events, meetings, and Google Calendar synchronization.",
    status: "MVP" as const,
    icon: CalendarDays,
  },
  {
    id: "tasks",
    title: "Task & Daily Planner",
    description:
      "Organize tasks, projects, subtasks, deadlines, and AI-generated daily plans.",
    status: "MVP" as const,
    icon: ListTodo,
  },
  {
    id: "assistant",
    title: "Hermes AI Assistant",
    description:
      "An intelligent agent that helps manage activities and automate workflows.",
    status: "MVP" as const,
    icon: Bot,
  },
  {
    id: "discord",
    title: "Discord Integration",
    description:
      "Manage your account through chat and receive automatic reminders.",
    status: "MVP" as const,
    icon: MessageCircle,
  },
  {
    id: "study",
    title: "Study Helper",
    description:
      "Transform learning materials into structured AI-powered study modules.",
    status: "Future" as const,
    icon: BookOpen,
  },
  {
    id: "fitness",
    title: "Fitness Tracker",
    description:
      "Track workout activities, training goals, and fitness progress.",
    status: "Future" as const,
    icon: Dumbbell,
  },
  {
    id: "finance",
    title: "Finance Tracker",
    description:
      "Monitor income, expenses, budgets, and personal financial goals.",
    status: "Future" as const,
    icon: Wallet,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Asteria
          </Link>

          <Link
            href="/about"
            className={buttonVariants({ variant: "outline" })}
          >
            About
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <Badge variant="secondary">
            AI-Powered Personal Operating System
          </Badge>

          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
            Manage your life.
            <span className="block text-blue-500">
              Intelligently.
            </span>
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Asteria brings your schedules, tasks, and productivity
            into one intelligent platform, powered by AI.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/about"
              className={buttonVariants({ size: "lg" })}
            >
              Explore Asteria
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8">
          <h2 className="text-3xl font-semibold tracking-tight">
            System Modules
          </h2>

          <p className="mt-2 text-muted-foreground">
            A modular ecosystem designed to grow with your needs.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <ModuleCard
              key={module.id}
              title={module.title}
              description={module.description}
              status={module.status}
              icon={module.icon}
            />
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Asteria — AI-powered Life Management System
      </footer>
    </main>
  );
}
