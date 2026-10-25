"use client";

import { useId, useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { Archive, ChevronDown, Folder, Inbox, ListTodo, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnWorkspaceResult, WorkspaceActions, WorkspaceProject, WorkspaceTask } from "../workspace-types";
import { workspaceHref } from "../workspace-view";
import { CreateProjectButton, ProjectMenu } from "./project-manager";

export function TodoSidebar({ projects, tasks, view, onNavigate, actions, onResult, compact = false }: {
  projects: WorkspaceProject[];
  tasks: WorkspaceTask[];
  view: string;
  onNavigate: (view: string) => void;
  actions: WorkspaceActions;
  onResult: OnWorkspaceResult;
  compact?: boolean;
}) {
  const archivedId = useId();
  const searchId = useId();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [archivedExpanded, setArchivedExpanded] = useState<boolean | null>(null);
  const activeProjects = projects.filter((project) => !project.isArchived);
  const archivedProjects = projects.filter((project) => project.isArchived);
  const activeTasks = tasks.filter((task) => task.status === "TODO" || task.status === "IN_PROGRESS");
  const showArchived = archivedExpanded ?? (!!query.trim() || archivedProjects.some((project) => project.id === view));
  const selectedProject = projects.find((project) => project.id === view);
  const matchesQuery = (project: WorkspaceProject) => project.name.toLowerCase().includes(query.trim().toLowerCase());
  const matchingActive = activeProjects.filter(matchesQuery);
  const matchingArchived = archivedProjects.filter(matchesQuery);

  function viewLink(id: string, label: string, count: number, icon: ReactNode, project = false) {
    return (
      <a
        href={workspaceHref(id)} aria-current={view === id ? "page" : undefined}
        title={label}
        aria-label={`${label}, ${count} active ${count === 1 ? "task" : "tasks"}`}
        onClick={(event) => {
          if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
            event.preventDefault();
            setProjectsOpen(false);
            setQuery("");
            onNavigate(id);
          }
        }}
        className={cn(
          "flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          compact && !project ? "flex-none" : "flex-1",
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
      <div key={project.id} className="flex w-full min-w-0 items-center gap-0.5 rounded-lg">
        {viewLink(project.id, project.name, activeTasks.filter((task) => task.projectId === project.id).length, project.isArchived ? <Archive className="size-4 shrink-0 text-muted-foreground" /> : <Folder className="size-4 shrink-0 text-muted-foreground" />, true)}
        <ProjectMenu project={project} view={view} actions={actions} onResult={onResult} />
      </div>
    );
  }

  const projectList = (
    <>
      <div className="relative mx-2 mb-3 shrink-0">
        <label htmlFor={searchId} className="sr-only">Search projects</label>
        <Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
        <input id={searchId} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setArchivedExpanded(null); }}
          placeholder="Find a project…" autoComplete="off"
          className="h-11 w-full min-w-0 rounded-lg border bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="max-h-80 min-h-0 min-w-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {matchingActive.map(projectRow)}
        {!matchingActive.length && <p className="px-3 py-4 text-sm leading-relaxed text-muted-foreground">
          {query.trim() ? "No active projects match your search." : "No projects yet. Create one to organize related tasks."}
        </p>}
        <Button type="button" variant="ghost" className="mt-2 min-h-11 w-full justify-start gap-2.5 px-3 font-normal text-muted-foreground"
          aria-expanded={showArchived} aria-controls={archivedId} onClick={() => setArchivedExpanded(!showArchived)}>
          <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", !showArchived && "-rotate-90")} />
          <span className="min-w-0 flex-1 text-left text-xs">Archived projects</span>
          <span className="text-xs tabular-nums">{archivedProjects.length}</span>
        </Button>
        <div id={archivedId} hidden={!showArchived} className="space-y-1">
          {matchingArchived.length ? matchingArchived.map(projectRow) : <p className="px-3 py-2 text-sm text-muted-foreground">{query.trim() ? "No archived projects match your search." : "No archived projects."}</p>}
        </div>
      </div>
    </>
  );

  if (compact) {
    return (
      <nav aria-label="To-Do List views" className="flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-card/70 p-1.5">
        <div className="flex min-w-0 items-center gap-1">
          {viewLink("all", "All Tasks", activeTasks.length, <ListTodo className="size-4 shrink-0" />)}
          {viewLink("inbox", "Inbox", activeTasks.filter((task) => !task.projectId).length, <Inbox className="size-4 shrink-0" />)}
        </div>

        <div className="flex min-w-0 items-center gap-1 border-l pl-2">
          <Popover.Root open={projectsOpen} onOpenChange={(open) => { setProjectsOpen(open); if (!open) setQuery(""); }}>
            <Popover.Trigger asChild>
              <Button type="button" variant={selectedProject ? "secondary" : "ghost"} aria-label="Browse projects"
                title={selectedProject?.name ?? "Browse projects"} className="h-11 min-w-0 max-w-64 gap-2 px-3">
                <Folder className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{selectedProject?.name ?? (projects.length ? "Projects" : "No projects yet")}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{activeProjects.length}</span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={10} collisionPadding={16} aria-label="Choose a project"
                className="z-50 flex max-h-[var(--radix-popover-content-available-height)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-popover py-2 text-popover-foreground shadow-xl outline-none">
                <h2 className="shrink-0 px-5 pt-2 pb-3 text-sm font-semibold">Your projects</h2>
                {projectList}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <CreateProjectButton view={view} actions={actions} onResult={onResult} />
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="To-Do List views" className="min-w-0 space-y-1">
      {viewLink("all", "All Tasks", activeTasks.length, <ListTodo className="size-4 shrink-0" />)}
      {viewLink("inbox", "Inbox", activeTasks.filter((task) => !task.projectId).length, <Inbox className="size-4 shrink-0" />)}
      <div className="flex items-center justify-between pt-6 pl-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground">Projects</h2>
        <CreateProjectButton view={view} actions={actions} onResult={onResult} />
      </div>
      {projectList}
    </nav>
  );
}
