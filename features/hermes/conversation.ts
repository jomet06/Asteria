import type { HermesChatResult, HermesToolNote } from "./actions";

export type ChatTurn = {
  id: string;
  message: string;
  reply?: string;
  tools?: HermesToolNote[];
  error?: string;
};

export const MAX_MESSAGE_LENGTH = 2000;

export function conversationHistory(turns: ChatTurn[]) {
  // Failed requests must not turn into instructions on the next request.
  return turns.filter((turn) => turn.reply !== undefined).slice(-6).flatMap((turn) => [
    { role: "user" as const, text: turn.message },
    { role: "model" as const, text: turn.reply! },
  ]);
}

export function finishChatTurn(turn: ChatTurn, result: HermesChatResult): ChatTurn {
  return result.ok
    ? { ...turn, reply: result.reply, tools: result.tools, error: undefined }
    : { ...turn, error: result.error };
}

export const CHAT_ERRORS: Record<string, string> = {
  not_configured: "Asteria bot is not connected yet. Check the assistant setup.",
  invalid_message: "Write a message between 1 and 2,000 characters.",
  rate_limited: "The AI service is busy. Please wait a moment before sending again.",
  model_unavailable: "The AI model is unavailable. Check the assistant configuration.",
  hermes_timeout: "The request timed out. Check your workspace before sending it again, as an action may already have completed.",
  hermes_unavailable: "The request could not finish. Check your workspace before sending it again.",
};

export const TOOL_LABELS: Record<string, string> = {
  create_event: "Calendar event",
  create_task: "Task",
  complete_task: "Task update",
  find_free_slots: "Free time",
};
