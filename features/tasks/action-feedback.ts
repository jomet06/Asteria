import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readWorkspaceView, workspaceHref } from "./workspace-view";

export type WorkspaceActionResult = {
  kind: "status" | "error";
  message: string;
  view: string;
};

export function refreshWorkspace() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export function workspaceFeedback(
  formData: FormData,
  kind: "status" | "error",
  message: string,
  view = readWorkspaceView(formData.get("view"))
): WorkspaceActionResult {
  const selectedView = readWorkspaceView(view);

  // The response mode controls presentation only. Authentication and ownership
  // are checked in the action before either kind of response is produced.
  if (formData.get("responseMode") === "inline") {
    return { kind, message, view: selectedView };
  }

  const href = workspaceHref(selectedView);
  redirect(`${href}${href.includes("?") ? "&" : "?"}${kind}=${message}`);
}
