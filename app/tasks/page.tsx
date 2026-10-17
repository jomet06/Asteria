
import Link from "next/link";
import {
  CheckCircle2,
  ListTodo,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getMyTaskWorkspace } from "@/features/tasks/data";
import { TaskForm } from "@/features/tasks/task-form";

import {
  createTask,
  updateTask,
  toggleTaskStatus,
  deleteTask,
} from "@/features/tasks/actions";

export const instant = false;

type TasksPageProps = {
  searchParams: Promise<{
    status?: string;
    error?: string;
  }>;
};

const successMessages: Record<string, string> = {
  created: "Task created successfully.",
  updated: "Task updated successfully.",
  deleted: "Task deleted successfully.",
};

const errorMessages: Record<string, string> = {
  invalid_input: "Please check your task information.",
  invalid_project: "The selected project is unavailable.",
  not_found: "Task not found or access denied.",
};

const statusLabels: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export default async function TasksPage({
  searchParams,
}: TasksPageProps) {
  const { status, error } = await searchParams;
  const { tasks, projects } = await getMyTaskWorkspace();

  const completedCount = tasks.filter(
    (task) => task.status === "DONE"
  ).length;

  return (
    <AppShell activePage="tasks">
      <header className="mb-8">
        <Badge variant="secondary">
          Productivity Core
        </Badge>

        <h1 className="mt-4 flex items-center gap-3 text-3xl font-bold tracking-tight">
          <ListTodo className="size-8" />
          My Tasks
        </h1>

        <p className="mt-3 text-muted-foreground">
          Manage assignments, priorities, and deadlines.
        </p>
      </header>

      {status && successMessages[status] && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-green-600/30 bg-green-500/5 p-4 text-sm"
        >
          {successMessages[status]}
        </p>
      )}

      {error && errorMessages[error] && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-red-600/30 bg-red-500/5 p-4 text-sm"
        >
          {errorMessages[error]}
        </p>
      )}

      <section className="mb-10">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Create New Task</CardTitle>

            <CardDescription>
              Add an activity to your workspace.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <TaskForm
              action={createTask}
              projects={projects}
              submitLabel="Create Task"
            />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="task-list-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="task-list-title"
              className="text-xl font-semibold"
            >
              Your Tasks
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {completedCount} completed / {tasks.length} total
            </p>
          </div>

          <Link
            href="/projects"
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage Projects →
          </Link>
        </div>

        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ListTodo className="mx-auto mb-4 size-10 text-muted-foreground" />

              <h3 className="text-lg font-semibold">
                No tasks yet
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                Create your first task using the form above.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {tasks.map((task) => {
              const project = projects.find(
                (item) => item.id === task.projectId
              );

              const isCompleted = task.status === "DONE";

              return (
                <Card key={task.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <CardTitle className="break-words">
                        {task.title}
                      </CardTitle>

                      <Badge variant="outline">
                        {statusLabels[task.status] ??
                          task.status}
                      </Badge>
                    </div>

                    <CardDescription className="break-words">
                      {task.description ||
                        "No description."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {project?.name ?? "No Project"}
                      </Badge>

                      <Badge variant="outline">
                        Priority: {task.priority}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Due:{" "}
                      {task.dueAt
                        ? task.dueAt
                            .toISOString()
                            .slice(0, 10)
                        : "No deadline"}
                    </p>

                    <form action={toggleTaskStatus}>
                      <input
                        type="hidden"
                        name="taskId"
                        value={task.id}
                      />

                      <input
                        type="hidden"
                        name="nextStatus"
                        value={
                          isCompleted ? "TODO" : "DONE"
                        }
                      />

                      <Button
                        type="submit"
                        variant={
                          isCompleted
                            ? "outline"
                            : "secondary"
                        }
                        className="w-full"
                      >
                        {isCompleted ? (
                          <RotateCcw className="size-4" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}

                        {isCompleted
                          ? "Mark as To Do"
                          : "Mark as Done"}
                      </Button>
                    </form>

                    <details className="rounded-lg border p-3">
                      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <Pencil className="size-4" />
                        Edit Task
                      </summary>

                      <div className="mt-4">
                        <TaskForm
                          action={updateTask}
                          projects={projects}
                          task={task}
                          submitLabel="Save Changes"
                        />
                      </div>
                    </details>

                    <details className="rounded-lg border border-destructive/30 p-3">
                      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-destructive">
                        <Trash2 className="size-4" />
                        Delete Task
                      </summary>

                      <p className="mt-3 text-xs text-muted-foreground">
                        This action cannot be undone.
                        Related subtasks will also
                        be deleted.
                      </p>

                      <form
                        action={deleteTask}
                        className="mt-3"
                      >
                        <input
                          type="hidden"
                          name="taskId"
                          value={task.id}
                        />

                        <Button
                          type="submit"
                          variant="destructive"
                          size="sm"
                        >
                          Confirm Delete
                        </Button>
                      </form>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
