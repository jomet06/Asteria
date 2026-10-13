
import Link from "next/link";

const modules = [
  {
    id: "calendar",
    name: "Calendar",
    description: "Manage your schedules and events.",
    status: "Coming Soon",
  },
  {
    id: "tasks",
    name: "Task & Daily Planner",
    description: "Organize tasks, projects, and daily plans.",
    status: "Coming Soon",
  },
  {
    id: "ai",
    name: "AI Assistant",
    description: "Manage your life with Hermes AI.",
    status: "Coming Soon",
  },
  {
    id: "finance",
    name: "Finance Tracker",
    description: "Track expenses and financial goals.",
    status: "Future Module",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">

        {/* Header */}
        <header className="mb-16">
          <span className="text-sm font-medium text-blue-400">
            PERSONAL LIFE MANAGEMENT SYSTEM
          </span>

          <h1 className="mt-4 text-5xl font-bold">
            Asteria
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-zinc-400">
            Your AI-powered Personal Operating System.
            Manage your schedule, tasks, and productivity
            in one intelligent platform.
          </p>

          <Link
            href="/about"
            className="mt-8 inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium transition hover:bg-blue-700"
          >
            Explore Asteria
          </Link>
        </header>

        {/* Modules Section */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold">
            System Modules
          </h2>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <article
                key={module.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <h3 className="text-xl font-semibold">
                  {module.name}
                </h3>

                <p className="mt-3 text-sm text-zinc-400">
                  {module.description}
                </p>

                <span className="mt-6 inline-block rounded-full bg-zinc-800 px-3 py-1 text-xs text-blue-300">
                  {module.status}
                </span>
              </article>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
