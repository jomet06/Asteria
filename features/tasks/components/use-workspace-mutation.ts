"use client";

import { useRef, useState, useTransition } from "react";
import type { OnWorkspaceResult, WorkspaceAction } from "../workspace-types";

import { feedbackMessages } from "../workspace-messages";
export { feedbackMessages } from "../workspace-messages";

export const fieldClass = "w-full min-h-11 rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function useWorkspaceMutation(onResult: OnWorkspaceResult) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const locked = useRef(false);

  function run(action: WorkspaceAction, data: FormData, onSuccess?: () => void) {
    if (locked.current) return;
    locked.current = true;
    setError("");
    data.set("responseMode", "inline");
    startTransition(async () => {
      try {
        const result = await action(data);
        if (result.kind === "error") {
          setError(feedbackMessages[result.message] ?? "Something went wrong. Please try again.");
        } else {
          onResult(result);
          onSuccess?.();
        }
      } catch {
        setError("Could not save your changes. Check your connection and try again. Your draft is still here.");
      } finally {
        locked.current = false;
      }
    });
  }

  return { pending, error, run, clearError: () => setError("") };
}

