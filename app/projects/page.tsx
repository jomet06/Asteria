
import {
  Archive,
  FolderKanban,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getMyProjects } from "@/features/tasks/projects/data";

import {
  createProject,
  updateProject,
  setProjectArchived,
  deleteProject,
} from "@/features/tasks/projects/actions";

export const instant = false;

type ProjectsPageProps = {
  searchParams: Promise<{
    status?: string;
    error?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  created: "Project created successfully.",
  updated: "Project updated successfully.",
  archived: "Project archived.",
  restored: "Project restored.",
  deleted: "Project deleted.",
};

const errorMessages: Record<string, string> = {
  invalid_input: "Please check your project information.",
  not_found: "Project not found or access denied.",
};

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const { status, error } = await searchParams;
  const projects = await getMyProjects();

  const activeCount = projects.filter(
    (project) => !project.isArchived
  ).length;

  return (
    <AppShell activePage="projects">
      <div className="mb-8">
        <Badge variant="secondary">
          Productivity Core
        </Badge>

        <h1 className="mt-4 flex items-center gap-3 text-3xl font-bold tracking-tight">
          <FolderKanban className="size-8" />
          My Projects
        </h1>

        <p className="mt-3 text-muted-foreground">
          Organize your goals, activities, and future tasks.
        </p>
      </div>

      {status && statusMessages[status] && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-green-600/30 bg-green-500/5 p-4 text-sm"
        >
          {statusMessages[status]}
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
            <CardTitle>Create Project</CardTitle>

            <CardDescription>
              Create a workspace for related tasks.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              action={createProject}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="project-name"
                  className="block text-sm font-medium"
                >
                  Project Name
                </label>

                <input
                  id="project-name"
                  name="name"
                  type="text"
                  required
                  maxLength={120}
                  placeholder="e.g. University"
                  className="mt-2 w-full rounded-lg border bg-background px-4 py-3"
                />
              </div>

              <div>
                <label
                  htmlFor="project-description"
                  className="block text-sm font-medium"
                >
                  Description (optional)
                </label>

                <textarea
                  id="project-description"
                  name="description"
                  rows={3}
                  maxLength={1000}
                  placeholder="What is this project about?"
                  className="mt-2 w-full rounded-lg border bg-background px-4 py-3"
                />
              </div>

              <Button type="submit">
                <Plus className="size-4" />
                Create Project
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="projects-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="projects-title"
              className="text-xl font-semibold"
            >
              Your Projects
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {activeCount} active / {projects.length} total
            </p>
          </div>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderKanban className="mx-auto mb-4 size-10 text-muted-foreground" />

              <h3 className="text-lg font-semibold">
                No projects yet
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                Create your first project using the form above.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CardTitle className="break-words">
                      {project.name}
                    </CardTitle>

                    <Badge
                      variant={
                        project.isArchived
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {project.isArchived
                        ? "Archived"
                        : "Active"}
                    </Badge>
                  </div>

                  <CardDescription className="wrap-break-word">
                    {project.description ||
                      "No description."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {project._count.tasks} task(s)
                  </p>

                  <details className="rounded-lg border p-3">
                    <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <Pencil className="size-4" />
                      Edit Project
                    </summary>

                    <form
                      action={updateProject}
                      className="mt-4 space-y-3"
                    >
                      <input
                        type="hidden"
                        name="projectId"
                        value={project.id}
                      />

                      <div>
                        <label
                          htmlFor={`name-${project.id}`}
                          className="block text-sm font-medium"
                        >
                          Name
                        </label>

                        <input
                          id={`name-${project.id}`}
                          name="name"
                          type="text"
                          required
                          maxLength={120}
                          defaultValue={project.name}
                          className="mt-2 w-full rounded-lg border bg-background px-3 py-2"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`description-${project.id}`}
                          className="block text-sm font-medium"
                        >
                          Description
                        </label>

                        <textarea
                          id={`description-${project.id}`}
                          name="description"
                          maxLength={1000}
                          rows={3}
                          defaultValue={
                            project.description ?? ""
                          }
                          className="mt-2 w-full rounded-lg border bg-background px-3 py-2"
                        />
                      </div>

                      <Button type="submit" size="sm">
                        Save Changes
                      </Button>
                    </form>
                  </details>

                  <form action={setProjectArchived}>
                    <input
                      type="hidden"
                      name="projectId"
                      value={project.id}
                    />

                    <input
                      type="hidden"
                      name="archive"
                      value={
                        project.isArchived
                          ? "false"
                          : "true"
                      }
                    />

                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {project.isArchived ? (
                        <RotateCcw className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}

                      {project.isArchived
                        ? "Restore Project"
                        : "Archive Project"}
                    </Button>
                  </form>

                  <details className="rounded-lg border border-destructive/30 p-3">
                    <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-destructive">
                      <Trash2 className="size-4" />
                      Delete Project
                    </summary>

                    <p className="mt-3 text-xs text-muted-foreground">
                      This action cannot be undone.
                      Tasks will remain but will no
                      longer belong to this project.
                    </p>

                    <form
                      action={deleteProject}
                      className="mt-3"
                    >
                      <input
                        type="hidden"
                        name="projectId"
                        value={project.id}
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
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
