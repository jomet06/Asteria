// Hermes is Asteria's AI agent, powered by Google Gemini.
// The API key lives in GEMINI_API_KEY; without it every Hermes
// surface degrades to setup instructions instead of failing.

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function geminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : null;
}

export function geminiModel(): string {
  const model = process.env.GEMINI_MODEL?.trim();
  return model ? model : DEFAULT_GEMINI_MODEL;
}

export function hermesConfigured(): boolean {
  return geminiApiKey() !== null;
}
