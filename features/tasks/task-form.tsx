
"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { ConfirmDialog } from "./components/workspace-dialog";
import {
  fieldClass,
  useWorkspaceMutation,
} from "./components/use-workspace-mutation";

import { SubtaskSection } from "./components/subtask-section";
import { ScheduleTask } from "./daily-planner/components/schedule-task";

import type {
  PlannerActionResult,
} from "./daily-planner/actions";

import type {
  OnWorkspaceResult,
  WorkspaceActions,
  WorkspaceProject,
  WorkspaceTask,
} from "./workspace-types";

type TaskDetailProps = {
  task: WorkspaceTask;
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  view: string;
  actions: WorkspaceActions;
  onResult: OnWorkspaceResult;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;

  today?: string;
  addTaskToDay?: (
    formData: FormData
  ) => Promise<PlannerActionResult>;
};

function initialFields(task: WorkspaceTask) {
  return {
    title: task.title,
    description: task.description ?? "",
    projectId: task.projectId ?? "",
    status: task.status,
    priority: task.priority,
    dueDate: task.dueAt?.slice(0, 10) ?? "",
    // Defaults keep older fixtures that predate these fields rendering.
    difficulty: task.difficulty ?? "NORMAL",
    estimatedMinutes: task.estimatedMinutes?.toString() ?? "",
    progress: (task.progress ?? 0).toString(),
    dependsOnTaskId: task.dependsOnTaskId ?? "",
  };
}

export function TaskDetail({
  task,
  tasks,
  projects,
  view,
  actions,
  onResult,
  onClose,
  onDirtyChange,
  onPendingChange,
  today,
  addTaskToDay,
}: TaskDetailProps) {
  const prefix = useId();

  const [original] = useState(() =>
    initialFields(task)
  );

  const [draft, setDraft] = useState(original);

  const [confirmDelete, setConfirmDelete] =
    useState(false);

  const save = useWorkspaceMutation(onResult);
  const deletion = useWorkspaceMutation(onResult);

  const saveErrorRef = useRef<HTMLParagraphElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const dirty = Object.keys(original).some(
    (key) => {
      const field = key as keyof typeof original;

      return original[field] !== draft[field];
    }
  );

  const busy = save.pending || deletion.pending;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onPendingChange?.(busy);
  }, [busy, onPendingChange]);

  useEffect(() => {
    if (save.error) {
      saveErrorRef.current?.focus();
    }
  }, [save.error]);

  function finish() {
    onDirtyChange?.(false);
    onClose();
  }

  const canSchedule =
    task.status !== "DONE" &&
    task.status !== "CANCELLED";

  return (
    <>
      <form
        ref={formRef}
        className="flex min-h-full flex-col gap-6"
        aria-label="Edit task"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();

          save.run(
            actions.updateTask,
            new FormData(event.currentTarget),
            finish
          );
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.metaKey || event.ctrlKey)
          ) {
            event.preventDefault();

            if (!busy && !confirmDelete) {
              formRef.current?.requestSubmit();
            }
          }
        }}
      >
        <input
          type="hidden"
          name="taskId"
          value={task.id}
        />

        <input
          type="hidden"
          name="view"
          value={view}
        />

        <fieldset
          disabled={busy}
          className="min-w-0 space-y-6"
        >
          {/* TASK TITLE */}
          <div>
            <label
              htmlFor={`${prefix}-title`}
              className="sr-only"
            >
              Task title
            </label>

            <textarea
              id={`${prefix}-title`}
              name="title"
              required
              maxLength={200}
              rows={2}
              value={draft.title}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  title: event.target.value,
                })
              }
              placeholder="Task title"
              className="w-full resize-none rounded-lg bg-transparent px-2 py-1 text-xl font-semibold leading-snug tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* DESCRIPTION */}
          <div>
            <label
              htmlFor={`${prefix}-description`}
              className="mb-2 block text-sm font-medium"
            >
              Description
            </label>

            <textarea
              id={`${prefix}-description`}
              name="description"
              rows={4}
              maxLength={2000}
              value={draft.description}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  description: event.target.value,
                })
              }
              placeholder="Add notes or context..."
              className={`${fieldClass} resize-y leading-relaxed`}
            />
          </div>

          {/* SUBTASKS */}
          <SubtaskSection
            taskId={task.id}
            view={view}
            subtasks={task.subtasks ?? []}
            actions={actions}
            onResult={onResult}
          />

          {/* DAILY PLANNER */}
          {canSchedule && addTaskToDay && today && (
            dirty ? (
              <p
                role="note"
                className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground"
              >
                Save or discard your Task changes
                before scheduling it.
              </p>
            ) : (
              <ScheduleTask
                taskId={task.id}
                today={today}
                addTaskToDay={addTaskToDay}
              />
            )
          )}

          {/* TASK PROPERTIES */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={`${prefix}-status`}
                className="mb-2 block text-sm font-medium"
              >
                Status
              </label>

              <select
                id={`${prefix}-status`}
                name="status"
                value={draft.status}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    status: event.target.value as WorkspaceTask["status"],
                    // Completed tasks are always 100% done.
                    ...(event.target.value === "DONE"
                      ? { progress: "100" }
                      : {}),
                  })
                }
                className={fieldClass}
              >
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label
                htmlFor={`${prefix}-priority`}
                className="mb-2 block text-sm font-medium"
              >
                Priority
              </label>

              <select
                id={`${prefix}-priority`}
                name="priority"
                value={draft.priority}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    priority: event.target.value as WorkspaceTask["priority"],
                  })
                }
                className={fieldClass}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div className="col-span-2">
              <label
                htmlFor={`${prefix}-due-date`}
                className="mb-2 block text-sm font-medium"
              >
                Due date
                <span className="ml-1 font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>

              <input
                id={`${prefix}-due-date`}
                name="dueDate"
                type="date"
                value={draft.dueDate}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    dueDate: event.target.value,
                  })
                }
                className={`${fieldClass} [color-scheme:light] dark:[color-scheme:dark]`}
              />
            </div>

            <div className="col-span-2">
              <label
                htmlFor={`${prefix}-project`}
                className="mb-2 block text-sm font-medium"
              >
                Project
              </label>

              <select
                id={`${prefix}-project`}
                name="projectId"
                value={draft.projectId}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    projectId: event.target.value,
                  })
                }
                className={fieldClass}
              >
                <option value="">Inbox</option>

                {projects
                  .filter(
                    (project) =>
                      !project.isArchived ||
                      project.id === task.projectId
                  )
                  .map((project) => (
                    <option
                      key={project.id}
                      value={project.id}
                    >
                      {project.name}
                      {project.isArchived
                        ? " (Archived)"
                        : ""}
                    </option>
                  ))}
              </select>
            </div>

            {/* AI DAILY PLANNING INPUTS */}
            <div>
              <label
                htmlFor={`${prefix}-difficulty`}
                className="mb-2 block text-sm font-medium"
              >
                Difficulty
              </label>

              <select
                id={`${prefix}-difficulty`}
                name="difficulty"
                value={draft.difficulty}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    difficulty: event.target.value as WorkspaceTask["difficulty"],
                  })
                }
                className={fieldClass}
              >
                <option value="EASY">Easy</option>
                <option value="NORMAL">Normal</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div>
              <label
                htmlFor={`${prefix}-estimate`}
                className="mb-2 block text-sm font-medium"
              >
                Estimate
                <span className="ml-1 font-normal text-muted-foreground">
                  (minutes, optional)
                </span>
              </label>

              <input
                id={`${prefix}-estimate`}
                name="estimatedMinutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                step={5}
                value={draft.estimatedMinutes}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    estimatedMinutes: event.target.value,
                  })
                }
                placeholder="45"
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor={`${prefix}-progress`}
                className="mb-2 block text-sm font-medium"
              >
                Progress (%)
              </label>

              <input
                id={`${prefix}-progress`}
                name="progress"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={draft.progress}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    progress: event.target.value,
                  })
                }
                disabled={draft.status === "DONE"}
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor={`${prefix}-depends-on`}
                className="mb-2 block text-sm font-medium"
              >
                Depends on
                <span className="ml-1 font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>

              <select
                id={`${prefix}-depends-on`}
                name="dependsOnTaskId"
                value={draft.dependsOnTaskId}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    dependsOnTaskId: event.target.value,
                  })
                }
                className={fieldClass}
              >
                <option value="">Nothing</option>

                {tasks
                  .filter((item) => item.id !== task.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.status === "DONE"
                        ? " (completed)"
                        : item.status === "CANCELLED"
                          ? " (cancelled)"
                          : ""}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* SAVE ERROR */}
        {save.error && (
          <p
            ref={saveErrorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {save.error}
          </p>
        )}

        {/* ACTION FOOTER */}
        <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-3 border-t bg-background pt-4 pb-1">
          <Button
            ref={deleteButtonRef}
            type="button"
            variant="ghost"
            className="min-h-11 text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={() => {
              deletion.clearError();
              setConfirmDelete(true);
            }}
          >
            <Trash2
              className="size-4"
              aria-hidden="true"
            />
            Delete task
          </Button>

          <Button
            type="submit"
            disabled={busy}
            className="min-h-11 px-4"
          >
            {save.pending && (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            )}

            {save.pending
              ? "Saving..."
              : "Save changes"}
          </Button>
        </div>
      </form>

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description={`“${task.title}” will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete task"
        pending={deletion.pending}
        error={deletion.error}
        returnFocusRef={deleteButtonRef}
        onConfirm={() => {
          const data = new FormData();

          data.set("taskId", task.id);
          data.set("view", view);

          deletion.run(
            actions.deleteTask,
            data,
            finish
          );
        }}
      />
    </>
  );
}
