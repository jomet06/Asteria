
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Bot,
  CalendarSync,
  Check,
  Clock3,
  ListChecks,
  ShieldCheck,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Starfield } from "@/components/landing/starfield";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { ProductTour } from "@/components/landing/product-tour";

import { getFeaturesByStatus } from "@/features/registry";

const mvpFeatures = getFeaturesByStatus("MVP");
const futureFeatures = getFeaturesByStatus("Future");

const heroStats = [
  { icon: CalendarSync, label: "2-way Google Calendar sync" },
  { icon: Bot, label: "Hermes AI on Gemini" },
  { icon: ListChecks, label: "Smart daily planning" },
  { icon: ShieldCheck, label: "Owner-scoped by design" },
];

const nowNext = [
  { time: "09:00 – 10:30", title: "Essay draft", tone: "bg-primary" },
  { time: "14:00 – 16:00", title: "Design sync", tone: "bg-sky-500" },
  { time: "19:00 – 20:00", title: "Read chapter 4", tone: "bg-emerald-500" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      {/* HERO: night sky */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#070b1c] via-[#0b1230] to-background">
        <Starfield />
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-36 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:pb-32 lg:pt-44">
          <div>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
              Manage your life.
              <span className="block bg-gradient-to-r from-indigo-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
                Intelligently.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              Asteria unites your calendar, tasks, and daily planning in one
              workspace, with Hermes AI connecting every context and Google
              Calendar &amp; Discord built in.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register" className={buttonVariants({ size: "lg" })}>
                Get started free
                <ArrowRight className="ml-1 size-4" aria-hidden="true" />
              </Link>
              <Link
                href="#tour"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Take the tour
              </Link>
            </div>

            <ul className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {heroStats.map((stat) => (
                <li key={stat.label} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <stat.icon className="size-4 shrink-0 text-indigo-300" aria-hidden="true" />
                  {stat.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Floating today-card preview */}
          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <div
              aria-hidden="true"
              className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-indigo-500/25 via-transparent to-violet-500/20 blur-2xl"
            />
            <div className="animate-landing-float relative rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl motion-reduce:animate-none">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Today</p>
                <p className="text-xs text-slate-300">Saturday, 25 October</p>
              </div>

              <div className="mt-4 rounded-2xl bg-white/10 p-4">
                <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                  <Clock3 className="size-3.5" aria-hidden="true" /> Happening now
                </p>
                <p className="mt-1 text-sm font-semibold text-white">Essay draft</p>
                <p className="text-xs text-slate-300">until 10:30am</p>
              </div>

              <div className="mt-4 space-y-2.5">
                {nowNext.map((item) => (
                  <div key={item.title} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3.5 py-2.5">
                    <span className={`size-2 shrink-0 rounded-full ${item.tone}`} aria-hidden="true" />
                    <span className="w-24 shrink-0 text-[11px] tabular-nums text-slate-300">{item.time}</span>
                    <span className="truncate text-xs font-medium text-white">{item.title}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-white/15 p-3.5">
                <Bot className="size-4 shrink-0 text-indigo-300" aria-hidden="true" />
                <p className="text-xs text-slate-300">
                  Daily plan ready: <span className="font-medium text-white">3 tasks</span> arranged by Hermes
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT TOUR */}
      <section id="tour" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Product tour</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            One workspace, four superpowers
          </h2>
          <p className="mt-3 text-muted-foreground">
            Click through the modules: everything you see is live in the app today.
          </p>
        </div>
        <ProductTour />
      </section>

      {/* CORE MODULES */}
      <section id="modules" className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl scroll-mt-24 px-6">
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Core modules</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything in the MVP, shipped
            </h2>
            <p className="mt-3 text-muted-foreground">
              Each module owns its data and contributes context to Hermes, so new
              modules plug in without touching the core.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {mvpFeatures.map((feature) => (
              <article
                key={feature.id}
                className="group relative flex h-full flex-col rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
              >
                <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5" aria-hidden="true" /> Live today
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section id="roadmap" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Roadmap</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Built to become your Personal OS
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              The architecture is modular by design: every future module feeds
              new context to Hermes, so recommendations and automation grow
              richer over time, with no rewrites, just additions.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Calendar knows when things happen",
                "Tasks & Planner know what must be done",
                "Hermes connects every context into action",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div aria-hidden="true" className="absolute left-[1.4rem] top-4 bottom-4 w-px bg-border" />
            <ol className="space-y-5">
              {futureFeatures.map((feature, index) => (
                <li key={feature.id} className="relative flex items-start gap-4">
                  <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background">
                    <feature.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <div className="rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
                    <p className="text-sm font-semibold">
                      {feature.title}
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Phase 5
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{feature.description}</p>
                  </div>
                  <span className="sr-only">Module {index + 1}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background to-[#0b1230] py-24">
        <Starfield density={12000} />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <Image src="/brand/asteria-icon.svg" alt="" width={56} height={56} className="mx-auto size-14 rounded-2xl" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Your day, intelligently arranged
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Set up in minutes: connect Google Calendar, link Discord, and let
            Hermes take care of the planning.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register" className={buttonVariants({ size: "lg" })}>
              Create your workspace
              <ArrowRight className="ml-1 size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t bg-[#070b1c] py-10 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm sm:flex-row">
          <p>Asteria · AI-powered Life Management System</p>
          <nav aria-label="Footer" className="flex items-center gap-5">
            <Link href="#tour" className="hover:text-white">Tour</Link>
            <Link href="/login" className="hover:text-white">Login</Link>
            <Link href="/register" className="hover:text-white">Get Started</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
