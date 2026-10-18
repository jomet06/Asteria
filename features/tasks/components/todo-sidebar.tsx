"use client";

import { useId, useState, type ReactNode } from "react";
import { Archive, ChevronDown, Folder, Inbox, ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnWorkspaceResult, WorkspaceActions, WorkspaceProject, WorkspaceTask } from "../workspace-types";
import { workspaceHref } from "../workspace-view";
import { CreateProjectButton, ProjectMenu } from "./project-manager";

export function TodoSidebar({ projects, tasks, view, onNavigate, actions, onResult }: {
  projects: WorkspaceProject[];
  tasks: WorkspaceTask[];
  view: string;
  onNavigate: (view: string) => void;
  actions: WorkspaceActions;
  onResult: OnWorkspaceResult;
}) {
  const archivedId = useId();
  const [archivedExpanded, setArchivedExpanded] = useState<boolean | null>(null);
  const activeProjects = projects.filter((project) => !project.isArchived);
  const archivedProjects = projects.filter((project) => project.isArchived);
  const activeTasks = tasks.filter((task) => task.status === "TODO" || task.status === "IN_PROGRESS");
  const showArchived = archivedExpanded ?? archivedProjects.some((project) => project.id === view);

  function viewLink(id: string, label: string, count: number, icon: ReactNode) {
    return (
      <a
        href={workspaceHref(id)} aria-current={view === id ? "page" : undefined}
        aria-label={`${label}, ${count} active ${count === 1 ? "task" : "tasks"}`}
        onClick={(event) => {
          if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
            event.preventDefault();
            onNavigate(id);
          }
        }}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          view === id && "bg-secondary font-medium text-secondary-foreground"
        )}
      >
        {icon}<span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-hidden="true">{count || ""}</span>
      </a>
    );
  }

  function projectRow(project: WorkspaceProject) {
    return (
      <div key={project.id} className="flex min-w-0 items-center gap-0.5">
        {viewLink(project.id, project.name, activeTasks.filter((task) => task.projectId === project.id).length, project.isArchived ? <Archive className="size-4 shrink-0 text-muted-foreground" /> : <Folder className="size-4 shrink-0 text-muted-foreground" />)}
        <ProjectMenu project={project} view={view} actions={actions} onResult={onResult} />
      </div>
    );
  }

  return (
    <nav aria-label="To-Do List views" className="min-w-0 space-y-1">
      <p className="px-3 pt-1 pb-3 text-xs font-medium tracking-wide text-muted-foreground">Your workspace</p>
      {viewLink("all", "All Tasks", activeTasks.length, <ListTodo className="size-4 shrink-0" />)}
      {viewLink("inbox", "Inbox", activeTasks.filter((task) => !task.projectId).length, <Inbox className="size-4 shrink-0" />)}
      <div className="flex items-center justify-between pt-6 pl-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground">Projects</h2>
        <CreateProjectButton view={view} actions={actions} onResult={onResult} />
      </div>
      {activeProjects.length === 0 && <p className="px-3 py-2 text-sm leading-relaxed text-muted-foreground">Keep tasks together with a project, or start in Inbox.</p>}
      {activeProjects.map(projectRow)}
      <div className="pt-6">
        <Button
          type="button" variant="ghost" className="min-h-11 w-full justify-start gap-2.5 px-3 font-normal text-muted-foreground"
          aria-expanded={showArchived} aria-controls={archivedId} onClick={() => setArchivedExpanded(!showArchived)}
        >
          <ChevronDown className={cn("size-3.5 transition-transform", !showArchived && "-rotate-90")} />
          <span className="flex-1 text-left text-xs">Archived Projects</span>
          {archivedProjects.length > 0 && <span className="text-xs tabular-nums">{archivedProjects.length}</span>}
        </Button>
        <div id={archivedId} hidden={!showArchived} className="mt-1 space-y-1">{archivedProjects.length ? archivedProjects.map(projectRow) : <p className="px-3 py-2 text-sm text-muted-foreground">No archived projects.</p>}</div>
      </div>
    </nav>
  );
}
