"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { DropdownMenu } from "radix-ui";
import { Archive, Ellipsis, LoaderCircle, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OnWorkspaceResult, WorkspaceActions, WorkspaceProject } from "../workspace-types";
import { ConfirmDialog, WorkspaceDialog } from "./workspace-dialog";
import { fieldClass, useWorkspaceMutation } from "./use-workspace-mutation";

type ProjectControlsProps = {
  view: string;
  actions: WorkspaceActions;
  onResult: OnWorkspaceResult;
};

function ProjectEditor({ project, view, actions, onResult, onClose, onSaved, onDirtyChange, onPendingChange }: ProjectControlsProps & {
  project?: WorkspaceProject;
  onClose: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const id = useId();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const { pending, error, run } = useWorkspaceMutation(onResult);
  useEffect(() => {
    onPendingChange(pending);
    return () => onPendingChange(false);
  }, [pending, onPendingChange]);

  return (
    <form
      className="space-y-5"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        onPendingChange(true);
        run(project ? actions.updateProject : actions.createProject, new FormData(event.currentTarget), onSaved);
      }}
    >
      <input type="hidden" name="view" value={view} />
      {project && <input type="hidden" name="projectId" value={project.id} />}
      <div className="space-y-2">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">Project name</label>
        <input id={`${id}-name`} name="name" required maxLength={120} value={name} onChange={(event) => {
          setName(event.target.value);
          onDirtyChange(event.target.value !== (project?.name ?? "") || description !== (project?.description ?? ""));
        }} placeholder="e.g. Personal, Work, A new idea" className={fieldClass} disabled={pending} autoComplete="off" />
      </div>
      <div className="space-y-2">
        <label htmlFor={`${id}-description`} className="text-sm font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea id={`${id}-description`} name="description" rows={3} maxLength={1000} value={description} onChange={(event) => {
          setDescription(event.target.value);
          onDirtyChange(name !== (project?.name ?? "") || event.target.value !== (project?.description ?? ""));
        }} placeholder="What is this project for?" className={`${fieldClass} resize-y`} disabled={pending} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" className="min-h-11 px-4" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button type="submit" className="min-h-11 px-4" disabled={pending || !name.trim()}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : project ? "Save project" : "Create project"}
        </Button>
      </div>
    </form>
  );
}

function ProjectEditorDialog({ open, onOpenChange, project, returnFocusRef, ...controls }: ProjectControlsProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: WorkspaceProject;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const discardFocus = useRef<HTMLElement | null>(null);

  function close() {
    setDirty(false);
    setPending(false);
    setDiscardOpen(false);
    onOpenChange(false);
  }

  function requestClose() {
    if (pending) return;
    if (dirty) {
      discardFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setDiscardOpen(true);
    } else close();
  }

  return (
    <>
      <WorkspaceDialog
        open={open} onOpenChange={(next) => { if (next) onOpenChange(true); else requestClose(); }}
        title={project ? "Edit project" : "New project"}
        description={project ? "A clear name makes tasks easier to find." : "Give related tasks a place to live."}
        returnFocusRef={returnFocusRef}
      >
        {open && <ProjectEditor {...controls} project={project} onClose={requestClose} onSaved={close} onDirtyChange={setDirty} onPendingChange={setPending} />}
      </WorkspaceDialog>
      <ConfirmDialog
        open={discardOpen} onOpenChange={setDiscardOpen} title="Discard project changes?"
        description="Your unsaved changes will be lost." confirmLabel="Discard changes" onConfirm={close} returnFocusRef={discardFocus}
      />
    </>
  );
}

export function CreateProjectButton({ view, actions, onResult }: ProjectControlsProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button ref={trigger} type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground hover:text-foreground" onClick={() => setOpen(true)} aria-label="New project">
        <Plus className="size-4" />
      </Button>
      <ProjectEditorDialog open={open} onOpenChange={setOpen} view={view} actions={actions} onResult={onResult} returnFocusRef={trigger} />
    </>
  );
}

const menuItemClass = "flex min-h-11 cursor-default items-center gap-2 rounded-md px-3 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export function ProjectMenu({ project, view, actions, onResult }: ProjectControlsProps & { project: WorkspaceProject }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { pending, error, run, clearError } = useWorkspaceMutation(onResult);

  function projectData() {
    const data = new FormData();
    data.set("view", view);
    data.set("projectId", project.id);
    return data;
  }

  return (
    <>
      <DropdownMenu.Root open={menuOpen} onOpenChange={(open) => { if (!pending) { setMenuOpen(open); if (open) clearError(); } }}>
        <DropdownMenu.Trigger asChild>
          <Button ref={trigger} type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Actions for ${project.name}`}>
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end" sideOffset={4} collisionPadding={12}
            onCloseAutoFocus={(event) => { if (dialog) event.preventDefault(); }}
            className="z-50 w-56 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            <DropdownMenu.Label className="truncate px-3 py-2 text-xs font-medium text-muted-foreground">{project.name}</DropdownMenu.Label>
            <DropdownMenu.Item className={menuItemClass} disabled={pending} onSelect={() => setDialog("edit")}><Pencil className="size-4" />Edit project</DropdownMenu.Item>
            <DropdownMenu.Item className={menuItemClass} disabled={pending} onSelect={(event) => {
              event.preventDefault();
              const data = projectData();
              data.set("archive", project.isArchived ? "false" : "true");
              run(actions.setProjectArchived, data, () => setMenuOpen(false));
            }}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : project.isArchived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
              {project.isArchived ? "Restore project" : "Archive project"}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item className={`${menuItemClass} text-destructive`} disabled={pending} onSelect={() => { clearError(); setDialog("delete"); }}><Trash2 className="size-4" />Delete project…</DropdownMenu.Item>
            {error && <p role="alert" className="px-3 py-2 text-xs text-destructive">{error}</p>}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ProjectEditorDialog open={dialog === "edit"} onOpenChange={(open) => { if (!open) setDialog(null); }} project={project} view={view} actions={actions} onResult={onResult} returnFocusRef={trigger} />
      <ConfirmDialog
        open={dialog === "delete"} onOpenChange={(open) => { if (!open) setDialog(null); }}
        title={`Delete “${project.name}”?`}
        description="This cannot be undone. All tasks in this project will be kept and moved to Inbox."
        confirmLabel="Delete project" pending={pending} error={error} returnFocusRef={trigger}
        onConfirm={() => run(actions.deleteProject, projectData(), () => setDialog(null))}
      />
    </>
  );
}
