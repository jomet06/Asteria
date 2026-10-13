
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FeatureSection } from "@/components/feature-section";

import { getFeaturesByStatus } from "@/features/registry";

const mvpFeatures = getFeaturesByStatus("MVP");
const futureFeatures = getFeaturesByStatus("Future");

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
          >
            Asteria
          </Link>

          <Link
            href="/about"
            className={buttonVariants({
              variant: "outline",
            })}
          >
            About
          </Link>
        </div>
      </header>

      {/* Hero */}
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
            Asteria brings your schedules, tasks,
            and productivity into one intelligent
            platform, powered by AI.
          </p>

          <div className="mt-8">
            <Link
              href="/about"
              className={buttonVariants({
                size: "lg",
              })}
            >
              Explore Asteria
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <FeatureSection
        title="Core Modules"
        description="Essential features included in the Asteria MVP."
        features={mvpFeatures}
      />

      {/* Future Modules */}
      <FeatureSection
        title="Future Modules"
        description="Additional modules planned for future development."
        features={futureFeatures}
      />

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Asteria — AI-powered Life Management System
      </footer>
    </main>
  );
}
