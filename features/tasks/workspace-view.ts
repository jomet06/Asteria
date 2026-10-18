export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A view is All Tasks, Inbox, or a project ID. It never grants data access.
export function readWorkspaceView(value: unknown): string {
  return typeof value === "string" &&
    (value === "inbox" || uuidPattern.test(value))
    ? value.toLowerCase()
    : "all";
}

export function workspaceHref(view: string): string {
  const selected = readWorkspaceView(view);
  return selected === "all" ? "/tasks" : `/tasks?view=${selected}`;
}

export function filterWorkspaceTasks<T extends { projectId: string | null }>(
  tasks: T[],
  view: string
): T[] {
  if (view === "all") return tasks;
  return tasks.filter((task) =>
    view === "inbox" ? task.projectId === null : task.projectId === view
  );
}
