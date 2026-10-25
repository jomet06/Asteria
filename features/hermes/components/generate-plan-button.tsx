"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { generateDailyPlanAction } from "../actions";

const PLAN_ERRORS: Record<string, string> = {
  not_configured: "Add GEMINI_API_KEY to .env.local to enable AI planning.",
  invalid_date: "That date is not valid.",
  no_open_tasks: "There are no open tasks to plan yet.",
  plan_empty: "Asteria bot could not build a plan from your tasks.",
  model_unavailable: "The configured Gemini model is not available for your key. Set GEMINI_MODEL to a supported model.",
  hermes_timeout: "Asteria bot took too long to plan. Try again shortly.",
  hermes_unavailable: "Asteria bot is unavailable right now. Try again shortly.",
};

export function GeneratePlanButton({ date }: { date: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    if (pending) return;
    const data = new FormData();
    data.set("date", date);

    startTransition(async () => {
      const response = await generateDailyPlanAction(data);
      if (response.ok) {
        setResult(
          `Planned ${response.added} task${response.added === 1 ? "" : "s"}${response.note ? ` — ${response.note}` : ""}`
        );
        setError(null);
        router.refresh();
      } else {
        setError(PLAN_ERRORS[response.error] ?? "Something went wrong.");
        setResult(null);
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={generate}
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        {pending ? "Planning…" : "Generate with Asteria bot"}
      </Button>
      {(result || error) && (
        <p role={error ? "alert" : "status"} className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error ?? result}
        </p>
      )}
    </div>
  );
}
