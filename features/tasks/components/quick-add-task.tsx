"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnWorkspaceResult, WorkspaceActions, WorkspaceProject } from "../workspace-types";
import { fieldClass, useWorkspaceMutation } from "./use-workspace-mutation";

export function QuickAddTask({ projects, view, actions, onResult, inputRef, onAdded }: {
  projects: WorkspaceProject[];
  view: string;
  actions: WorkspaceActions;
  onResult: OnWorkspaceResult;
  inputRef?: RefObject<HTMLInputElement | null>;
  onAdded?: () => void;
}) {
  const id = useId();
  const fallbackRef = useRef<HTMLInputElement>(null);
  const titleRef = inputRef ?? fallbackRef;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [chosenProject, setProject] = useState<{ view: string; id: string } | null>(null);
  const defaultProjectId = projects.some((project) => project.id === view && !project.isArchived) ? view : "";
  const projectId = chosenProject?.view === view && (chosenProject.id === "" || projects.some((project) => project.id === chosenProject.id && !project.isArchived)) ? chosenProject.id : defaultProjectId;
  const [expanded, setExpanded] = useState(false);
  const { pending, error, run } = useWorkspaceMutation(onResult);
  const focusAfterSave = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (!pending && focusAfterSave.current) {
      titleRef.current?.focus();
      focusAfterSave.current = false;
    }
  }, [pending, title, titleRef]);

  return (
    <form aria-label="Quick add task" aria-busy={pending} onInvalidCapture={() => setExpanded(true)} onSubmit={(event) => {
      event.preventDefault();
      if (!title.trim()) { titleRef.current?.focus(); return; }
      const data = new FormData(event.currentTarget);
      run(actions.createTask, data, () => {
        setTitle(""); setDescription(""); setDueDate(""); setPriority("MEDIUM");
        focusAfterSave.current = true; onAdded?.();
      });
    }} className="rounded-xl border border-border bg-card shadow-xs transition-shadow focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/10">
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="status" value="TODO" />
      <div className="flex items-center gap-1 p-2 sm:gap-2">
        <Plus aria-hidden="true" className="ml-2 size-5 shrink-0 text-muted-foreground" />
        <label htmlFor={`${id}-title`} className="sr-only">Task title</label>
        <input ref={titleRef} id={`${id}-title`} name="title" required maxLength={200} autoComplete="off" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to get done?" aria-describedby={error ? `${id}-error` : undefined} className="h-11 min-w-0 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground sm:text-sm" disabled={pending} />
        <Button type="submit" aria-label="Add task" disabled={pending || !title.trim()} className="h-10 px-3 sm:px-4">{pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Plus className="size-4 sm:hidden" />}<span className="hidden sm:inline">{pending ? "Adding…" : "Add task"}</span></Button>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        <button type="button" aria-expanded={expanded} aria-controls={`${id}-options`} onClick={() => setExpanded(!expanded)} className="flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />{expanded ? "Fewer details" : "Add details"}</button>
        <span className="truncate pr-2 text-xs text-muted-foreground">{projects.find((project) => project.id === projectId)?.name ?? "Inbox"}{dueDate ? ` · ${dueDate}` : ""}{priority !== "MEDIUM" ? ` · ${priority.toLowerCase()}` : ""}</span>
      </div>
      <div id={`${id}-options`} hidden={!expanded} className="space-y-3 border-t border-border/60 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-xs font-medium">Project<select name="projectId" value={projectId} onChange={(event) => setProject({ view, id: event.target.value })} disabled={pending} className={fieldClass}><option value="">Inbox</option>{projects.filter((project) => !project.isArchived).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium">Due date<input type="date" name="dueDate" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={pending} className={fieldClass} /></label>
          <label className="space-y-1.5 text-xs font-medium">Priority<select name="priority" value={priority} onChange={(event) => setPriority(event.target.value)} disabled={pending} className={fieldClass}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
        </div>
        <label className="block space-y-1.5 text-xs font-medium">Description<textarea name="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={2} placeholder="A little more context, if you need it" disabled={pending} className={`${fieldClass} resize-y`} /></label>
      </div>
      {error && <p ref={errorRef} tabIndex={-1} id={`${id}-error`} role="alert" className="px-4 pb-4 text-sm text-destructive outline-none">{error}</p>}
    </form>
  );
}
