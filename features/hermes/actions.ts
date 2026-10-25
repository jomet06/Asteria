"use server";

import { getMyAccount } from "@/features/profile/data";
import { readCalendarTimezone } from "@/features/calendar/date-time";
import { hermesConfigured } from "./config";
import { GeminiError } from "./gemini";
import { runHermesAgent, sanitizeHistory } from "./agent";
import { generateMyDailyPlan } from "./planning";

export type HermesToolNote = { name: string; summary: string };

export type HermesChatResult =
  | { ok: true; reply: string; tools: HermesToolNote[] }
  | { ok: false; error: "not_configured" | "invalid_message" | "rate_limited" | "model_unavailable" | "hermes_timeout" | "hermes_unavailable" };

export type HermesPlanResult =
  | { ok: true; added: number; note: string | null }
  | { ok: false; error: "invalid_date" | "not_configured" | "no_open_tasks" | "plan_empty" | "model_unavailable" | "hermes_timeout" | "hermes_unavailable" };

export async function sendHermesMessage(
  formData: FormData
): Promise<HermesChatResult> {
  const { user, profile } = await getMyAccount();
  if (!hermesConfigured()) return { ok: false, error: "not_configured" };

  const messageValue = formData.get("message");
  if (typeof messageValue !== "string") return { ok: false, error: "invalid_message" };
  const message = messageValue.trim();
  if (message.length < 1 || message.length > 2000) return { ok: false, error: "invalid_message" };

  let history: unknown;
  try {
    history = JSON.parse(typeof formData.get("history") === "string" ? String(formData.get("history")) : "[]");
  } catch {
    history = [];
  }

  try {
    const result = await runHermesAgent({
      ownerId: user.id,
      timezone: readCalendarTimezone(profile.timezone),
      history: sanitizeHistory(history),
      message,
    });
    return {
      ok: true,
      reply: result.reply,
      tools: result.tools.slice(0, 8).map((tool) => ({
        name: tool.name,
        summary: typeof tool.summary === "string" ? tool.summary.slice(0, 300) : "",
      })),
    };
  } catch (error) {
    // Log the cause server-side (dev terminal) without leaking response bodies.
    console.error("[hermes] chat failed:", error instanceof GeminiError ? `${error.kind} status=${error.status ?? "n/a"}` : error);
    if (error instanceof GeminiError && error.status === 429) {
      return { ok: false, error: "rate_limited" };
    }
    if (error instanceof GeminiError && error.status === 404) {
      return { ok: false, error: "model_unavailable" };
    }
    if (error instanceof GeminiError && error.kind === "timeout") {
      return { ok: false, error: "hermes_timeout" };
    }
    return { ok: false, error: "hermes_unavailable" };
  }
}

export async function generateDailyPlanAction(
  formData: FormData
): Promise<HermesPlanResult> {
  return generateMyDailyPlan(formData.get("date"));
}
