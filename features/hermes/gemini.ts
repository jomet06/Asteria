// Minimal typed REST client for the Google Generative Language API.
// Uses native fetch with function calling and JSON-schema responses;
// no SDK dependency. API responses are never surfaced verbatim.

import { geminiApiKey, geminiModel } from "./config";

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
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};

export type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

export class GeminiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 30_000;

function textFromParts(parts: GeminiPart[]): string | null {
  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  return text || null;
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
  const apiKey = geminiApiKey();
  if (!apiKey) throw new GeminiError("Gemini is not configured.", null);

  const generationConfig: Record<string, unknown> = { temperature };
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

  let response: Response;
  try {
    response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(geminiModel())}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
  } catch {
    throw new GeminiError("Could not reach the Gemini service.", null);
  }

  if (!response.ok) {
    // Map known statuses; never surface the response body (it may echo prompts).
    if (response.status === 429) throw new GeminiError("Gemini rate limit reached.", 429);
    if (response.status === 401 || response.status === 403) {
      throw new GeminiError("The Gemini API key was rejected.", response.status);
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
    throw new GeminiError("Gemini returned an unreadable response.", null);
  }

  if (data.promptFeedback?.blockReason) {
    throw new GeminiError("Gemini blocked this request for safety reasons.", null);
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return { parts, text: textFromParts(parts) };
}

export { textFromParts };
