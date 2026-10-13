
import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className={buttonVariants({ variant: "outline" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="mt-10 text-4xl font-bold">
          About Asteria
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Asteria is an AI-powered Personal Operating System
          designed to integrate productivity and everyday
          life management into a modular platform.
        </p>

        <Card className="mt-10">
          <CardHeader>
            <CardTitle>Our Vision</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="leading-relaxed text-muted-foreground">
              To create an intelligent Life Management System
              where AI connects calendars, tasks, learning,
              and future modules to help users plan and manage
              their daily activities.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
