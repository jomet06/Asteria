import { buildHermesContext } from "./context";
import { executeToolSafe, hermesTools } from "./tools";
import { generateContent, textFromParts, type GeminiContent } from "./gemini";

const MAX_STEPS = 4;
const MAX_HISTORY = 12;
const MAX_REPLY = 4000;

export type HermesHistoryMessage = { role: "user" | "model"; text: string };

export type HermesRunResult = {
  reply: string;
  tools: { name: string; summary: string }[];
};

function interruptedReply(tools: HermesRunResult["tools"]): HermesRunResult {
  return {
    reply: `The AI reply could not finish. Here is the workspace activity recorded for this request:\n\n${tools.slice(0, 8).map((tool) => `- ${tool.summary}`).join("\n")}\n\nReview this activity before sending the request again.`,
    tools,
  };
}

const HERMES_SYSTEM = [
  "You are Asteria bot, the AI assistant inside Asteria — a personal productivity workspace.",
  "You can see a snapshot of the user's calendar events and open tasks for today.",
  "Act only through the provided tools; never invent ids that were not given to you.",
  "Prefer creating events and tasks when the user asks for it, then briefly confirm what you did.",
  "If a tool reports an error, tell the user plainly instead of retrying silently.",
  "Keep replies short, concrete and friendly. Reply in the user's language.",
].join(" ");

/** Read raw history from the client and keep only safe, bounded turns. */
export function sanitizeHistory(input: unknown): HermesHistoryMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (item): item is HermesHistoryMessage =>
        typeof item === "object" &&
        item !== null &&
        ((item as HermesHistoryMessage).role === "user" || (item as HermesHistoryMessage).role === "model") &&
        typeof (item as HermesHistoryMessage).text === "string" &&
        Boolean((item as HermesHistoryMessage).text.trim())
    )
    .slice(-MAX_HISTORY)
    .map((item) => ({
      role: item.role === "model" ? ("model" as const) : ("user" as const),
      text: item.text.slice(0, 2000),
    }));
}

/**
 * Run one Hermes conversation turn: the model may call workspace tools
 * for up to MAX_STEPS rounds before a final plain-language answer.
 */
export async function runHermesAgent({
  ownerId,
  timezone,
  history,
  message,
}: {
  ownerId: string;
  timezone: Parameters<typeof buildHermesContext>[1];
  history: HermesHistoryMessage[];
  message: string;
}): Promise<HermesRunResult> {
  const context = await buildHermesContext(ownerId, timezone);
  const system = [
    HERMES_SYSTEM,
    `Today is ${context.today} (timezone ${context.timezone}).`,
    `Workspace snapshot: ${JSON.stringify({ events: context.events, tasks: context.tasks })}`,
  ].join("\n\n");

  const contents: GeminiContent[] = [
    ...history.map((item) => ({ role: item.role, parts: [{ text: item.text }] })),
    { role: "user", parts: [{ text: message }] },
  ];

  const tools: { name: string; summary: string }[] = [];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    let parts;
    try {
      ({ parts } = await generateContent({ system, contents, tools: hermesTools }));
    } catch (error) {
      // Completed tools remain visible even if the model's next response fails.
      if (tools.length) return interruptedReply(tools);
      throw error;
    }

    const calls = parts
      .map((part) => part.functionCall)
      .filter((call): call is { name: string; args?: Record<string, unknown> } => Boolean(call));

    if (!calls.length) {
      return { reply: (textFromParts(parts) ?? "I could not produce an answer.").slice(0, MAX_REPLY), tools };
    }

    contents.push({ role: "model", parts });

    const responses: GeminiContent["parts"] = [];
    for (const call of calls) {
      const outcome = await executeToolSafe(call.name, call.args ?? {}, { ownerId, timezone });
      tools.push({ name: call.name, summary: outcome.summary });
      responses.push({
        functionResponse: { name: call.name, response: { ...outcome.result, summary: outcome.summary } },
      });
    }
    contents.push({ role: "user", parts: responses });
  }

  // Force a plain answer after the step budget.
  contents.push({
    role: "user",
    parts: [{ text: "Summarize what you did and what is left, briefly." }],
  });
  try {
    const final = await generateContent({ system, contents });
    return { reply: (textFromParts(final.parts) ?? "Done. Ask me anything else.").slice(0, MAX_REPLY), tools };
  } catch (error) {
    if (tools.length) return interruptedReply(tools);
    throw error;
  }
}
