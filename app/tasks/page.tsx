import { connection } from "next/server";

import { AppShell } from "@/components/app-shell";
import { getMyTaskWorkspace } from "@/features/tasks/data";
import { createTask, updateTask, toggleTaskStatus, deleteTask } from "@/features/tasks/actions";
import { createProject, updateProject, setProjectArchived, deleteProject } from "@/features/tasks/projects/actions";
import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { feedbackMessages } from "@/features/tasks/workspace-messages";
import { readWorkspaceView } from "@/features/tasks/workspace-view";

export const instant = false;

export default async function TasksPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const { tasks, projects } = await getMyTaskWorkspace();
  const code = typeof params.error === "string" ? params.error : typeof params.status === "string" ? params.status : "";
  const initialMessage = Object.hasOwn(feedbackMessages, code) ? {
    kind: typeof params.error === "string" ? "error" as const : "status" as const,
    text: feedbackMessages[code],
  } : undefined;

  return (
    <AppShell activePage="tasks" workspace>
      <TaskWorkspace
        tasks={tasks.map(({ id, title, description, projectId, status, priority, dueAt }) => ({ id, title, description, projectId, status, priority, dueAt: dueAt?.toISOString() ?? null }))}
        projects={projects.map(({ id, name, description, isArchived }) => ({ id, name, description, isArchived }))}
        actions={{ createTask, updateTask, toggleTaskStatus, deleteTask, createProject, updateProject, setProjectArchived, deleteProject }}
        initialView={readWorkspaceView(params.view)}
        initialMessage={initialMessage}
        today={new Date().toISOString().slice(0, 10)}
      />
    </AppShell>
  );
}
