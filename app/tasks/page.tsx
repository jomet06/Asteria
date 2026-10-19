
import { connection } from "next/server";

import { AppShell } from "@/components/app-shell";
import { getMyTaskWorkspace } from "@/features/tasks/data";

import {
  createTask,
  updateTask,
  toggleTaskStatus,
  deleteTask,
} from "@/features/tasks/actions";

import {
  createProject,
  updateProject,
  setProjectArchived,
  deleteProject,
} from "@/features/tasks/projects/actions";

import {
  createSubtask,
  updateSubtask,
  toggleSubtask,
  deleteSubtask,
} from "@/features/tasks/subtasks/actions";

import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { feedbackMessages } from "@/features/tasks/workspace-messages";
import { readWorkspaceView } from "@/features/tasks/workspace-view";

export const instant = false;

type TasksPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

export default async function TasksPage({
  searchParams,
}: TasksPageProps) {
  await connection();

  const params = await searchParams;

  const { tasks, projects } =
    await getMyTaskWorkspace();

  const code =
    typeof params.error === "string"
      ? params.error
      : typeof params.status === "string"
        ? params.status
        : "";

  const initialMessage =
    Object.hasOwn(feedbackMessages, code)
      ? {
          kind:
            typeof params.error === "string"
              ? ("error" as const)
              : ("status" as const),
          text: feedbackMessages[code],
        }
      : undefined;

  return (
    <AppShell activePage="tasks" workspace>
      <TaskWorkspace
        tasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          projectId: task.projectId,
          status: task.status,
          priority: task.priority,
          dueAt: task.dueAt?.toISOString() ?? null,

          subtasks: task.subtasks.map((subtask) => ({
            id: subtask.id,
            title: subtask.title,
            isCompleted: subtask.isCompleted,
            position: subtask.position,
          })),
        }))}
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          isArchived: project.isArchived,
        }))}
        actions={{
          createTask,
          updateTask,
          toggleTaskStatus,
          deleteTask,
          createProject,
          updateProject,
          setProjectArchived,
          deleteProject,
          createSubtask,
          updateSubtask,
          toggleSubtask,
          deleteSubtask,
        }}
        initialView={readWorkspaceView(params.view)}
        initialMessage={initialMessage}
        today={new Date().toISOString().slice(0, 10)}
      />
    </AppShell>
  );
}
