// Hermes is Asteria's AI agent, powered by Google Gemini.
// The API key lives in GEMINI_API_KEY; without it every Hermes
// surface degrades to setup instructions instead of failing.

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

// Gemini 3.x models think by default; a small budget keeps chat turns
// responsive while still planning tool calls well. Override or disable
// with GEMINI_THINKING_BUDGET (send without thinking when set to "none").
export const DEFAULT_GEMINI_THINKING_BUDGET = 512;

export function geminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : null;
}

export function geminiModel(): string {
  const model = process.env.GEMINI_MODEL?.trim();
  return model ? model : DEFAULT_GEMINI_MODEL;
}

/** null means "omit thinkingConfig"; "none" disables thinking entirely. */
export function geminiThinkingBudget(): number | "none" | null {
  const raw = process.env.GEMINI_THINKING_BUDGET?.trim();
  if (!raw) return DEFAULT_GEMINI_THINKING_BUDGET;
  if (raw.toLowerCase() === "none") return "none";
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function hermesConfigured(): boolean {
  return geminiApiKey() !== null;
}
