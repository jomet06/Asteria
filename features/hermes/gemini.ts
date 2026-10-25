// Minimal typed REST client for the Google Generative Language API.
// Uses native fetch with function calling and JSON-schema responses;
// no SDK dependency. API responses are never surfaced verbatim.
// Transient failures (429/5xx/network) are retried with backoff.

import {
  geminiApiKey,
  geminiModel,
  geminiThinkingBudget,
} from "./config";

export type GeminiSchemaType =
  | "STRING"
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "ARRAY"
  | "OBJECT";

export type GeminiSchema = {
  type: GeminiSchemaType;
  description?: string;
  enum?: string[];
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
};

export type GeminiTool = {
  name: string;
  description: string;
  parameters: GeminiSchema;
};

export type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown> };
};

export type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

export class GeminiError extends Error {
  status: number | null;
  kind: "http" | "network" | "timeout";

  constructor(message: string, status: number | null = null, kind: "http" | "network" | "timeout" = status === null ? "network" : "http") {
    super(message);
    this.status = status;
    this.kind = kind;
  }
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
// Gemini 3.x thinking models can take a minute or more on structured outputs.
const TIMEOUT_MS = 120_000;
const RETRY_DELAYS_MS = [1000, 3000];

function textFromParts(parts: GeminiPart[]): string | null {
  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  return text || null;
}

async function postGenerate(body: Record<string, unknown>): Promise<Response> {
  const apiKey = geminiApiKey();
  if (!apiKey) throw new GeminiError("Gemini is not configured.", null);

  try {
    return await fetch(
      `${ENDPOINT}/${encodeURIComponent(geminiModel())}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new GeminiError("Gemini took too long to respond.", null, "timeout");
    }
    throw new GeminiError("Could not reach the Gemini service.", null, "network");
  }
}

async function attemptOnce(body: Record<string, unknown>): Promise<{ parts: GeminiPart[]; text: string | null }> {
  const response = await postGenerate(body);

  if (!response.ok) {
    // Map known statuses; never surface the response body (it may echo prompts).
    if (response.status === 429) throw new GeminiError("Gemini rate limit reached.", 429);
    if (response.status === 401 || response.status === 403) {
      throw new GeminiError("The Gemini API key was rejected.", response.status);
    }
    if (response.status === 404) {
      throw new GeminiError("The configured Gemini model is not available for this API key.", 404);
    }
    throw new GeminiError("Gemini request failed.", response.status);
  }

  let data: {
    candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    throw new GeminiError("Gemini returned an unreadable response.", null, "network");
  }

  if (data.promptFeedback?.blockReason) {
    throw new GeminiError("Gemini blocked this request for safety reasons.", null);
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return { parts, text: textFromParts(parts) };
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof GeminiError &&
    (error.kind === "network" ||
      error.status === 429 ||
      error.status === 500 ||
      error.status === 503)
  );
}

export async function generateContent({
  system,
  contents,
  tools,
  jsonSchema,
  temperature = 0.4,
}: {
  system: string;
  contents: GeminiContent[];
  tools?: GeminiTool[];
  jsonSchema?: GeminiSchema;
  temperature?: number;
}): Promise<{ parts: GeminiPart[]; text: string | null }> {
  const generationConfig: Record<string, unknown> = { temperature };
  const budget = geminiThinkingBudget();
  if (budget === "none") {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  } else if (budget !== null) {
    generationConfig.thinkingConfig = { thinkingBudget: budget };
  }
  if (jsonSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = jsonSchema;
  }

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig,
    ...(tools?.length ? { tools: [{ functionDeclarations: tools }] } : {}),
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
    }
    try {
      return await attemptOnce(body);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
    }
  }
  throw lastError;
}

export { textFromParts };
