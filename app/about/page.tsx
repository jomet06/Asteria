
import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">

        <h1 className="text-4xl font-bold">
          About Asteria
        </h1>

        <p className="mt-6 leading-relaxed text-zinc-400">
          Asteria is an AI-powered Personal Operating System
          designed to manage productivity, schedules, tasks,
          and other aspects of daily life.
        </p>

        <h2 className="mt-10 text-2xl font-semibold">
          Our Vision
        </h2>

        <p className="mt-4 leading-relaxed text-zinc-400">
          To build a modular Life Management System where
          artificial intelligence connects different modules
          and helps users organize their activities.
        </p>

        <Link
          href="/"
          className="mt-10 inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium hover:bg-blue-700"
        >
          Back to Home
        </Link>

      </div>
    </main>
  );
}
