"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendHermesMessage } from "./actions";
import { conversationHistory, finishChatTurn, MAX_MESSAGE_LENGTH, type ChatTurn } from "./conversation";

export function useHermesConversation() {
  const router = useRouter();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const sendingRef = useRef(false);

  async function send() {
    const text = input.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH || sendingRef.current) return;
    // Also cover rapid Enter/click submissions before React renders.
    sendingRef.current = true;
    const turn: ChatTurn = { id: crypto.randomUUID(), message: text };
    const data = new FormData();
    data.set("message", text);
    data.set("history", JSON.stringify(conversationHistory(turns)));
    setTurns((current) => [...current, turn]);
    setInput("");
    setPending(true);
    try {
      const result = await sendHermesMessage(data);
      setTurns((current) => current.map((item) => item.id === turn.id ? finishChatTurn(item, result) : item));
      if (!result.ok) setInput((draft) => draft || text);
      else if (result.tools.some((tool) => ["create_event", "create_task", "complete_task"].includes(tool.name))) router.refresh();
    } catch {
      setTurns((current) => current.map((item) => item.id === turn.id
        ? finishChatTurn(item, { ok: false, error: "hermes_unavailable" }) : item));
      setInput((draft) => draft || text);
    } finally {
      sendingRef.current = false;
      setPending(false);
    }
  }

  function newChat() {
    if (sendingRef.current) return;
    setTurns([]);
    setInput("");
  }

  return { turns, input, setInput, pending, send, newChat };
}

export type HermesConversation = ReturnType<typeof useHermesConversation>;
